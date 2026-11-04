import express from 'express';
import dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';

export const dashboardRouter = express.Router();

dashboardRouter.use(authenticate, requireWorkspace);

dashboardRouter.get('/', dashboardController.getDashboard);

export default dashboardRouter;
