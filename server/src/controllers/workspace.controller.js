import workspaceService from '../services/workspace.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';

/**
 * WorkspaceController
 * Handles incoming HTTP requests for workspace and membership operations.
 */
export class WorkspaceController {
  constructor(service = workspaceService) {
    this.service = service;
  }

  /**
   * POST /api/workspaces
   * Creates a new workspace and sets the creator as Owner.
   */
  createWorkspace = asyncHandler(async (req, res) => {
    const workspace = await this.service.createWorkspace(req.user.id, req.body);
    return ApiResponse.created(res, { workspace }, 'Workspace created successfully');
  });

  /**
   * GET /api/workspaces
   * Lists all workspaces in which the authenticated user is a member.
   */
  listWorkspaces = asyncHandler(async (req, res) => {
    const workspaces = await this.service.getUserWorkspaces(req.user.id);
    return ApiResponse.success(res, { count: workspaces.length, workspaces });
  });

  /**
   * GET /api/workspaces/current
   * Retrieves user's active workspace.
   */
  getCurrentWorkspace = asyncHandler(async (req, res) => {
    const activeHeaderId = req.headers['x-workspace-id'];
    const workspace = await this.service.getCurrentWorkspace(req.user.id, activeHeaderId);
    return ApiResponse.success(res, { workspace });
  });

  /**
   * GET /api/workspaces/:id
   * Retrieves full workspace details, settings, and member roster.
   */
  getWorkspace = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const workspace = await this.service.getWorkspaceById(workspaceId, req.user.id);
    return ApiResponse.success(res, { workspace });
  });

  /**
   * PUT /api/workspaces/:id
   * Updates workspace settings (name, description, color).
   */
  updateWorkspace = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const workspace = await this.service.updateWorkspace(workspaceId, req.user.id, req.body);
    return ApiResponse.success(res, { workspace }, 'Workspace updated successfully');
  });

  /**
   * DELETE /api/workspaces/:id
   * Permanently deletes a workspace and cascades related entities.
   */
  deleteWorkspace = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    await this.service.deleteWorkspace(workspaceId, req.user.id);
    return ApiResponse.success(res, {}, 'Workspace deleted successfully');
  });

  /**
   * POST /api/workspaces/:id/switch
   * Sets active workspace for the user.
   */
  switchWorkspace = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const workspace = await this.service.switchWorkspace(workspaceId, req.user.id);
    return ApiResponse.success(res, { workspace }, 'Switched workspace successfully');
  });

  /**
   * POST /api/workspaces/join
   * Joins an existing workspace via invite code.
   */
  joinWorkspace = asyncHandler(async (req, res) => {
    const { inviteCode } = req.body;
    const workspace = await this.service.joinWorkspaceByCode(inviteCode, req.user.id);
    return ApiResponse.success(res, { workspace }, 'Joined workspace successfully');
  });

  /**
   * GET /api/workspaces/:id/members
   * Lists all members of a workspace.
   */
  listMembers = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const members = await this.service.listMembers(workspaceId, req.user.id);
    return ApiResponse.success(res, { count: members.length, members });
  });

  /**
   * POST /api/workspaces/:id/members
   * Invites or adds a user to the workspace.
   */
  addMember = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const member = await this.service.addMember(workspaceId, req.user.id, req.body);
    return ApiResponse.created(res, { member }, 'Member added successfully');
  });

  /**
   * PUT /api/workspaces/:id/members/:userId
   * Updates an existing member's role.
   */
  updateMemberRole = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;
    const member = await this.service.updateMemberRole(workspaceId, req.user.id, targetUserId, role);
    return ApiResponse.success(res, { member }, 'Member role updated successfully');
  });

  /**
   * DELETE /api/workspaces/:id/members/:userId
   * Removes a member from the workspace.
   */
  removeMember = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const targetUserId = req.params.userId;
    await this.service.removeMember(workspaceId, req.user.id, targetUserId);
    return ApiResponse.success(res, {}, 'Member removed successfully');
  });

  /**
   * POST /api/workspaces/:id/leave
   * Leaves a workspace.
   */
  leaveWorkspace = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    await this.service.leaveWorkspace(workspaceId, req.user.id);
    return ApiResponse.success(res, {}, 'Left workspace successfully');
  });

  /**
   * POST /api/workspaces/:id/transfer-ownership
   * Transfers primary ownership to another workspace member.
   */
  transferOwnership = asyncHandler(async (req, res) => {
    const workspaceId = req.params.id;
    const { newOwnerId } = req.body;
    const workspace = await this.service.transferOwnership(workspaceId, req.user.id, newOwnerId);
    return ApiResponse.success(res, { workspace }, 'Ownership transferred successfully');
  });
}

export const workspaceController = new WorkspaceController();
export default workspaceController;
