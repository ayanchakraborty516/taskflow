const Workspace = require('../models/Workspace');

const requireWorkspace = async (req, res, next) => {
  try {
    // Look up workspace ID from header, query, body, or route param, or user's currentWorkspace
    const workspaceId =
      req.headers['x-workspace-id'] ||
      req.query.workspaceId ||
      req.params.workspaceId ||
      req.body.workspaceId ||
      req.body.workspace ||
      req.user.currentWorkspace;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'No active workspace specified. Please select or create a workspace.',
      });
    }

    const workspace = await Workspace.findById(workspaceId).populate(
      'members.user',
      'name email avatar jobTitle'
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found.',
      });
    }

    // Check if the current user is a member of this workspace
    const membership = workspace.members.find(
      (m) => m.user && m.user._id.toString() === req.user._id.toString()
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have access to this workspace.',
      });
    }

    req.workspace = workspace;
    req.membership = membership;
    req.workspaceRole = membership.role;
    next();
  } catch (error) {
    next(error);
  }
};

const requireRole = (allowedRoles = ['Owner', 'Admin']) => {
  return (req, res, next) => {
    if (!req.membership || !req.workspaceRole) {
      return res.status(403).json({
        success: false,
        message: 'Workspace membership verification required.',
      });
    }

    // If allowedRoles is a string, wrap in array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Owner always has all privileges
    if (req.workspaceRole === 'Owner' || roles.includes(req.workspaceRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of roles: ${roles.join(', ')}. Your role is ${req.workspaceRole}.`,
    });
  };
};

module.exports = {
  requireWorkspace,
  requireRole,
};
