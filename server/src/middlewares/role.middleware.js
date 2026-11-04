import { ForbiddenError } from '../utils/api-error.util.js';
import { WORKSPACE_ROLES } from '../constants/roles.constant.js';

/**
 * Enforces role-based access control within an authenticated workspace context.
 * Must be executed after authenticate and requireWorkspace middlewares.
 *
 * An Owner automatically passes all role checks.
 *
 * @param {string|string[]} allowedRoles - Role or array of roles permitted (e.g. ['Owner', 'Admin'])
 */
export const requireRole = (allowedRoles = [WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN]) => {
  return (req, res, next) => {
    const userRole = req.workspaceRole || req.membership?.role;

    if (!userRole) {
      return next(new ForbiddenError('Workspace membership verification required.'));
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Workspace Owner possesses all permissions unconditionally
    if (userRole === WORKSPACE_ROLES.OWNER || roles.includes(userRole)) {
      return next();
    }

    return next(
      new ForbiddenError(
        `Access denied. Requires one of roles: ${roles.join(', ')}. Your current role is ${userRole}.`
      )
    );
  };
};

export default requireRole;
