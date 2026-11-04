import { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } from '../utils/api-error.util.js';
import workspaceRepository from '../repositories/workspace.repository.js';

/**
 * Resolves active workspace context and enforces tenant boundary access.
 * Checks route params, request headers (x-workspace-id), query string, or body.
 * Enforces single authoritative workspace ID by rejecting conflicting identifiers.
 * Verifies that the authenticated user is an active member of the resolved workspace.
 *
 * Attaches to req:
 * - req.workspaceId
 * - req.workspace
 * - req.membership
 * - req.workspaceRole
 */
export const requireWorkspace = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new UnauthorizedError('Authentication required.'));
  }

  // Only consider req.params.id as a workspace ID if the route itself is a workspace route
  const isWorkspaceRoute = req.baseUrl ? req.baseUrl.endsWith('/workspaces') : false;
  const paramId = req.params.workspaceId || (isWorkspaceRoute ? req.params.id : null);
  const headerId = req.headers['x-workspace-id'];
  const queryId = req.query.workspaceId;
  const bodyId = req.body?.workspaceId || req.body?.workspace;

  const providedIds = [paramId, headerId, queryId, bodyId].filter(Boolean);

  let workspaceId;
  if (providedIds.length === 0) {
    // Fall back to user's currently active workspace if available
    if (req.user.currentWorkspaceId) {
      workspaceId = req.user.currentWorkspaceId;
    } else {
      return next(new BadRequestError('No active workspace specified. Please select or create a workspace.'));
    }
  } else {
    // Enforce conflict-free deterministic resolution: reject conflicting IDs
    const uniqueIds = [...new Set(providedIds)];
    if (uniqueIds.length > 1) {
      return next(
        new BadRequestError(
          'Conflicting workspace identifiers provided across route parameters, headers, query, or body.'
        )
      );
    }
    workspaceId = uniqueIds[0];
  }

  try {
    // If already verified in this request pipeline for this exact workspace ID, continue
    if (req.workspaceId === workspaceId && req.membership && req.workspaceRole) {
      return next();
    }

    const membership = await workspaceRepository.getMember(workspaceId, req.user.id);

    if (!membership) {
      // Differentiate between 404 (does not exist) and 403 (unauthorized tenant access)
      const workspaceExists = await workspaceRepository.findById(workspaceId);
      if (!workspaceExists) {
        return next(new NotFoundError('Workspace not found.'));
      }
      return next(new ForbiddenError('You do not have access to this workspace.'));
    }

    req.workspaceId = workspaceId;
    req.workspace = membership.workspace;
    req.membership = membership;
    req.workspaceRole = membership.role;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireWorkspaceMember = requireWorkspace;
export default requireWorkspace;
