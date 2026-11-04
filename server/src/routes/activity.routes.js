import express from 'express';
import activityController from '../controllers/activity.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';

export const activityRouter = express.Router();

activityRouter.use(authenticate, requireWorkspace);

activityRouter.get('/', activityController.getActivities);

export default activityRouter;
