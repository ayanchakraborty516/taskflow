import express from 'express';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { rateLimit } from '../middlewares/rate-limit.middleware.js';
import {
  registerValidator,
  loginValidator,
  updateProfileValidator,
  changePasswordValidator,
  refreshTokenValidator,
} from '../validators/auth.validator.js';

export const authRouter = express.Router();

// Public routes with rate limiting
authRouter.post('/register', rateLimit(10, 60 * 1000), validate(registerValidator), authController.register);
authRouter.post('/login', rateLimit(15, 60 * 1000), validate(loginValidator), authController.login);
authRouter.post('/refresh', validate(refreshTokenValidator), authController.refreshToken);
authRouter.post('/logout', authController.logout);

// Protected routes requiring active session
authRouter.get('/me', authenticate, authController.getMe);
authRouter.put('/profile', authenticate, validate(updateProfileValidator), authController.updateProfile);
authRouter.put('/password', authenticate, validate(changePasswordValidator), authController.changePassword);

export default authRouter;
