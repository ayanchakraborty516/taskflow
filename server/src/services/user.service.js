import userRepository from '../repositories/user.repository.js';
import { sanitizeUser } from '../utils/token.util.js';
import { NotFoundError } from '../utils/api-error.util.js';

export class UserService {
  constructor(userRepo = userRepository) {
    this.userRepo = userRepo;
  }

  /**
   * Retrieves users, optionally filtered by search query or workspace membership.
   */
  async getUsers({ search, workspaceId }) {
    const users = await this.userRepo.findUsers({ search, workspaceId });
    return users.map((u) => sanitizeUser(u));
  }

  /**
   * Retrieves a single user by primary key ID.
   */
  async getUserById(id) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return sanitizeUser(user);
  }
}

export const userService = new UserService();
export default userService;
