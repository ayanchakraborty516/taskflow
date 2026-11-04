import { getIO } from './socket.server.js';
import { getWorkspaceRoomName } from './workspace.room.js';
import logger from '../utils/logger.util.js';

export const emitToWorkspace = (workspaceId, eventName, payload) => {
  try {
    const io = getIO();
    const room = getWorkspaceRoomName(workspaceId);
    io.to(room).emit(eventName, payload);
    logger.debug({ room, eventName }, 'Emitted socket event to workspace');
  } catch (error) {
    logger.warn({ error: error.message, eventName }, 'Failed to emit socket event');
  }
};

