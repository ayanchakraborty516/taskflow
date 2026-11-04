import express from 'express';
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { getUsersValidator, getUserByIdValidator } from '../validators/user.validator.js';

export const userRouter = express.Router();

userRouter.use(authenticate);

userRouter.get('/', validate(getUsersValidator), userController.getUsers);
userRouter.get('/:id', validate(getUserByIdValidator), userController.getUserById);

export default userRouter;
