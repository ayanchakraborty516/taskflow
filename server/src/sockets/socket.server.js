import { Server } from 'socket.io';
import corsOptions from '../config/cors.config.js';
import logger from '../utils/logger.util.js';
import { SOCKET_EVENTS } from '../constants/events.constant.js';
import { handleWorkspaceJoin, handleWorkspaceLeave } from './workspace.room.js';

let ioInstance = null;

export const initSocketServer = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  ioInstance.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket client connected');

    socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, (data) => {
      handleWorkspaceJoin(socket, data);
    });

    socket.on(SOCKET_EVENTS.LEAVE_WORKSPACE, (data) => {
      handleWorkspaceLeave(socket, data);
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  logger.info('Socket.IO real-time server initialized.');
  return ioInstance;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO has not been initialized yet.');
  }
  return ioInstance;
};

export default { initSocketServer, getIO };

