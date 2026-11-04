import authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';
import { setAuthCookies, clearAuthCookies } from '../utils/token.util.js';

export class AuthController {
  constructor(service = authService) {
    this.service = service;
  }

  /**
   * Registers a new user account.
   */
  register = asyncHandler(async (req, res) => {
    const { user, token, refreshToken, workspace } = await this.service.register(req.body);
    setAuthCookies(res, token, refreshToken);

    return ApiResponse.created(
      res,
      {
        token,
        user,
        workspace,
      },
      'Registration successful.'
    );
  });

  /**
   * Authenticates an existing user and returns JWT credentials.
   */
  login = asyncHandler(async (req, res) => {
    const { user, token, refreshToken } = await this.service.login(req.body);
    setAuthCookies(res, token, refreshToken);

    return ApiResponse.success(
      res,
      {
        token,
        user,
      },
      'Logged in successfully.'
    );
  });

  /**
   * Logs out user, invalidates refresh token, and clears HTTP-only cookies.
   */
  logout = asyncHandler(async (req, res) => {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    await this.service.logout(req.user?.id, rawRefreshToken);
    clearAuthCookies(res);

    return ApiResponse.success(res, {}, 'User logged out successfully.');
  });

  /**
   * Retrieves profile and workspace memberships of currently logged-in user.
   */
  getMe = asyncHandler(async (req, res) => {
    const { user, workspaces } = await this.service.getCurrentUser(req.user.id);

    return ApiResponse.success(
      res,
      {
        user,
        workspaces,
      },
      'User profile retrieved successfully.'
    );
  });

  /**
   * Updates user profile fields.
   */
  updateProfile = asyncHandler(async (req, res) => {
    const updatedUser = await this.service.updateProfile(req.user.id, req.body);

    return ApiResponse.success(
      res,
      {
        user: updatedUser,
      },
      'Profile updated successfully.'
    );
  });

  /**
   * Changes user password and refreshes sessions.
   */
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { user, token, refreshToken } = await this.service.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );
    setAuthCookies(res, token, refreshToken);

    return ApiResponse.success(
      res,
      {
        token,
        user,
      },
      'Password changed successfully.'
    );
  });

  /**
   * Rotates and issues a new access/refresh token pair.
   */
  refreshToken = asyncHandler(async (req, res) => {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const { user, token, refreshToken } = await this.service.refreshTokens(rawRefreshToken);
    setAuthCookies(res, token, refreshToken);

    return ApiResponse.success(
      res,
      {
        token,
        refreshToken,
        user,
      },
      'Token refreshed successfully.'
    );
  });
}

export const authController = new AuthController();
export default authController;
