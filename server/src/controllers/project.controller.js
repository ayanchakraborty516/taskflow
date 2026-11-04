import projectService from '../services/project.service.js';
import { ApiResponse } from '../utils/api-response.util.js';
import { asyncHandler } from '../utils/async-handler.util.js';

/**
 * ProjectController
 * HTTP request/response handler for Project endpoints.
 */
export class ProjectController {
  constructor(service = projectService) {
    this.service = service;
  }

  /**
   * POST /api/projects
   * Creates a new project in the active workspace.
   */
  createProject = asyncHandler(async (req, res) => {
    const project = await this.service.createProject(
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body
    );
    return ApiResponse.created(res, { project }, 'Project created successfully');
  });

  /**
   * GET /api/projects
   * Lists projects within the active workspace with optional filters.
   */
  listProjects = asyncHandler(async (req, res) => {
    const filters = req.validatedQuery || req.query;
    const projects = await this.service.listProjects(req.workspaceId, filters);
    return ApiResponse.success(res, { count: projects.length, projects });
  });

  /**
   * GET /api/projects/:id
   * Retrieves full details for a project.
   */
  getProject = asyncHandler(async (req, res) => {
    const project = await this.service.getProjectById(req.params.id, req.workspaceId);
    return ApiResponse.success(res, { project });
  });

  /**
   * PUT /api/projects/:id
   * Updates project details.
   */
  updateProject = asyncHandler(async (req, res) => {
    const project = await this.service.updateProject(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body
    );
    return ApiResponse.success(res, { project }, 'Project updated successfully');
  });

  /**
   * DELETE /api/projects/:id
   * Deletes a project and its cascade dependencies.
   */
  deleteProject = asyncHandler(async (req, res) => {
    await this.service.deleteProject(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole
    );
    return ApiResponse.success(res, {}, 'Project deleted successfully');
  });

  /**
   * POST /api/projects/:id/archive
   * Archives a project.
   */
  archiveProject = asyncHandler(async (req, res) => {
    const project = await this.service.archiveProject(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole
    );
    return ApiResponse.success(res, { project }, 'Project archived successfully');
  });

  /**
   * POST /api/projects/:id/restore
   * Restores an archived project to in_progress.
   */
  restoreProject = asyncHandler(async (req, res) => {
    const project = await this.service.restoreProject(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole
    );
    return ApiResponse.success(res, { project }, 'Project restored successfully');
  });

  /**
   * GET /api/projects/:id/members
   * Lists all members of a project.
   */
  listProjectMembers = asyncHandler(async (req, res) => {
    const members = await this.service.listProjectMembers(req.params.id, req.workspaceId);
    return ApiResponse.success(res, { count: members.length, members });
  });

  /**
   * POST /api/projects/:id/members
   * Adds an active workspace member to the project.
   */
  addProjectMember = asyncHandler(async (req, res) => {
    const member = await this.service.addProjectMember(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.body.userId
    );
    return ApiResponse.created(res, { member }, 'Member added to project');
  });

  /**
   * DELETE /api/projects/:id/members/:userId
   * Removes a member from the project.
   */
  removeProjectMember = asyncHandler(async (req, res) => {
    await this.service.removeProjectMember(
      req.params.id,
      req.workspaceId,
      req.user.id,
      req.workspaceRole,
      req.params.userId
    );
    return ApiResponse.success(res, {}, 'Member removed from project');
  });
}

export const projectController = new ProjectController();
export default projectController;
