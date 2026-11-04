import userService from '../services/user.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';

export class UserController {
  constructor(service = userService) {
    this.service = service;
  }

  /**
   * Retrieves users, optionally filtered by workspace membership or search query.
   */
  getUsers = asyncHandler(async (req, res) => {
    const users = await this.service.getUsers(req.query);

    return ApiResponse.success(
      res,
      {
        count: users.length,
        users,
      },
      'Users retrieved successfully.'
    );
  });

  /**
   * Retrieves a single user by primary key ID.
   */
  getUserById = asyncHandler(async (req, res) => {
    const user = await this.service.getUserById(req.params.id);

    return ApiResponse.success(
      res,
      {
        user,
      },
      'User retrieved successfully.'
    );
  });
}

export const userController = new UserController();
export default userController;
