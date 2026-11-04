import logger from '../utils/logger.util.js';

export const getWorkspaceRoomName = (workspaceId) => `workspace:${workspaceId}`;

export const handleWorkspaceJoin = (socket, { workspaceId }) => {
  if (!workspaceId) return;
  const roomName = getWorkspaceRoomName(workspaceId);
  socket.join(roomName);
  logger.debug({ socketId: socket.id, roomName }, 'Socket joined workspace room');
};

export const handleWorkspaceLeave = (socket, { workspaceId }) => {
  if (!workspaceId) return;
  const roomName = getWorkspaceRoomName(workspaceId);
  socket.leave(roomName);
  logger.debug({ socketId: socket.id, roomName }, 'Socket left workspace room');
};

