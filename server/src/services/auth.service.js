import authRepository from '../repositories/auth.repository.js';
import userRepository from '../repositories/user.repository.js';
import { runInTransaction } from '../database/transaction.util.js';
import {
  hashPassword,
  comparePassword,
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  sanitizeUser,
} from '../utils/token.util.js';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
} from '../utils/api-error.util.js';

export class AuthService {
  constructor(authRepo = authRepository, userRepo = userRepository) {
    this.authRepo = authRepo;
    this.userRepo = userRepo;
  }

  /**
   * Generates a URL-friendly slug with unique random suffix.
   */
  generateSlug(name) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${base || 'workspace'}-${randomSuffix}`;
  }

  /**
   * Registers a new user and creates their primary workspace in an atomic transaction.
   */
  async register({ name, email, password, workspaceName }) {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new BadRequestError('An account with this email already exists.');
    }

    const hashedPassword = await hashPassword(password);
    const initialWorkspaceName = workspaceName?.trim() || `${name.trim().split(' ')[0]}'s Workspace`;
    const slug = this.generateSlug(initialWorkspaceName);

    const { rawToken, hashedToken, expiresAt } = generateRefreshToken();

    const { user, workspace } = await runInTransaction(async (tx) => {
      // 1. Create User
      const newUser = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
        },
      });

      // 2. Create Initial Workspace with Owner Membership
      const newWorkspace = await tx.workspace.create({
        data: {
          name: initialWorkspaceName,
          slug,
          ownerId: newUser.id,
          members: {
            create: {
              userId: newUser.id,
              role: 'Owner',
            },
          },
        },
      });

      // 3. Link current workspace
      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: { currentWorkspaceId: newWorkspace.id },
      });

      // 4. Save refresh token
      await this.authRepo.createRefreshToken(
        {
          token: hashedToken,
          userId: newUser.id,
          expiresAt,
        },
        tx
      );

      return { user: updatedUser, workspace: newWorkspace };
    });

    const accessToken = generateAccessToken(user);

    return {
      user: sanitizeUser(user),
      token: accessToken,
      refreshToken: rawToken,
      workspace,
    };
  }

  /**
   * Authenticates a user with email and password, returning tokens.
   */
  async login({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    // Ensure user has a valid active workspace selected
    let currentWorkspaceId = user.currentWorkspaceId;
    if (!currentWorkspaceId) {
      const workspaces = await this.userRepo.findUserWorkspaces(user.id);
      if (workspaces.length > 0) {
        currentWorkspaceId = workspaces[0].id;
        await this.userRepo.updateById(user.id, { currentWorkspaceId });
        user.currentWorkspaceId = currentWorkspaceId;
      }
    }

    const { rawToken, hashedToken, expiresAt } = generateRefreshToken();
    await this.authRepo.createRefreshToken({
      token: hashedToken,
      userId: user.id,
      expiresAt,
    });

    const accessToken = generateAccessToken(user);

    return {
      user: sanitizeUser(user),
      token: accessToken,
      refreshToken: rawToken,
    };
  }

  /**
   * Refreshes access token with refresh token rotation and reuse detection.
   */
  async refreshTokens(rawRefreshToken) {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token is required.');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const tokenRecord = await this.authRepo.findRefreshToken(tokenHash);

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    // REUSE DETECTION: If token was already revoked, terminate all sessions for this user!
    if (tokenRecord.revokedAt) {
      await this.authRepo.revokeAllUserTokens(tokenRecord.userId);
      throw new UnauthorizedError(
        'Revoked refresh token reused. All active sessions have been terminated for security.'
      );
    }

    // Check expiration
    if (new Date() > new Date(tokenRecord.expiresAt)) {
      await this.authRepo.revokeRefreshToken(tokenRecord.id);
      throw new UnauthorizedError('Refresh token expired. Please log in again.');
    }

    const user = tokenRecord.user;
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account is no longer active.');
    }

    // ROTATION: Atomically revoke old token and issue new pair
    const { rawToken: newRawToken, hashedToken: newHashedToken, expiresAt } = generateRefreshToken();

    await runInTransaction(async (tx) => {
      await this.authRepo.revokeRefreshToken(tokenRecord.id, tx);
      await this.authRepo.createRefreshToken(
        {
          token: newHashedToken,
          userId: user.id,
          expiresAt,
        },
        tx
      );
    });

    const newAccessToken = generateAccessToken(user);

    return {
      user: sanitizeUser(user),
      token: newAccessToken,
      refreshToken: newRawToken,
    };
  }

  /**
   * Logs out user by revoking their current refresh token.
   */
  async logout(userId, rawRefreshToken = null) {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      const tokenRecord = await this.authRepo.findRefreshToken(tokenHash);
      if (tokenRecord) {
        await this.authRepo.revokeRefreshToken(tokenRecord.id);
      }
    } else if (userId) {
      await this.authRepo.revokeAllUserTokens(userId);
    }

    return { success: true };
  }

  /**
   * Retrieves current authenticated user with their associated workspaces.
   */
  async getCurrentUser(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundError('User not found or inactive.');
    }

    const rawWorkspaces = await this.userRepo.findUserWorkspaces(userId);

    const workspaces = rawWorkspaces.map((w) => {
      const membership = w.members && w.members[0];
      return {
        id: w.id,
        _id: w.id,
        name: w.name,
        slug: w.slug,
        color: w.color,
        isOwner: w.ownerId === user.id,
        role: membership ? membership.role : 'Member',
        membersCount: w._count?.members || 1,
      };
    });

    return {
      user: sanitizeUser(user),
      workspaces,
    };
  }

  /**
   * Updates user profile fields.
   */
  async updateProfile(userId, { name, avatar, jobTitle, currentWorkspace }) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (avatar !== undefined) updates.avatar = avatar;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle.trim();

    if (currentWorkspace) {
      // Validate that user is actually a member of the requested workspace
      const userWorkspaces = await this.userRepo.findUserWorkspaces(userId);
      const targetWs = userWorkspaces.find((w) => w.id === currentWorkspace);
      if (targetWs) {
        updates.currentWorkspaceId = targetWs.id;
      }
    }

    const updated = await this.userRepo.updateById(userId, updates);
    return sanitizeUser(updated);
  }

  /**
   * Validates current password and sets a new password.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestError('Incorrect current password.');
    }

    const hashedPassword = await hashPassword(newPassword);

    await runInTransaction(async (tx) => {
      await this.userRepo.updateById(userId, { password: hashedPassword }, tx);
      // Revoke all existing refresh tokens for security
      await this.authRepo.revokeAllUserTokens(userId, tx);
    });

    const { rawToken, hashedToken, expiresAt } = generateRefreshToken();
    await this.authRepo.createRefreshToken({
      token: hashedToken,
      userId: user.id,
      expiresAt,
    });

    const accessToken = generateAccessToken(user);

    return {
      user: sanitizeUser(user),
      token: accessToken,
      refreshToken: rawToken,
    };
  }
}

export const authService = new AuthService();
export default authService;
