import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireWorkspace } from '../middlewares/workspace.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { markNotificationReadValidator } from '../validators/notification.validator.js';

export const notificationRouter = express.Router();

notificationRouter.use(authenticate);
notificationRouter.use(requireWorkspace);

notificationRouter.get('/', notificationController.getNotifications);
notificationRouter.put('/read-all', notificationController.markAllAsRead);
notificationRouter.put('/:id/read', validate(markNotificationReadValidator), notificationController.markAsRead);
notificationRouter.delete('/:id', notificationController.deleteNotification);

export default notificationRouter;
