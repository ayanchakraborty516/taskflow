import express from 'express';
import authRouter from './auth.routes.js';
import userRouter from './user.routes.js';
import workspaceRouter from './workspace.routes.js';
import projectRouter from './project.routes.js';
import taskRouter from './task.routes.js';
import commentRouter from './comment.routes.js';
import activityRouter from './activity.routes.js';
import notificationRouter from './notification.routes.js';
import dashboardRouter from './dashboard.routes.js';
import healthRouter from './health.routes.js';

export const apiRouter = express.Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/workspaces', workspaceRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/comments', commentRouter);
apiRouter.use('/activities', activityRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/dashboard', dashboardRouter);

export default apiRouter;

