const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const crypto = require('crypto');

// @desc    Get user's workspaces
// @route   GET /api/workspaces
// @access  Private
const getWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      'members.user': req.user._id,
    })
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar jobTitle');

    const result = await Promise.all(
      workspaces.map(async (ws) => {
        const projectsCount = await Project.countDocuments({ workspace: ws._id });
        const membership = ws.members.find((m) => m.user && m.user._id.toString() === req.user._id.toString());
        return {
          ...ws.toObject(),
          projectsCount,
          userRole: membership ? membership.role : 'Member',
        };
      })
    );

    res.status(200).json({ success: true, count: result.length, workspaces: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new workspace
// @route   POST /api/workspaces
// @access  Private
const createWorkspace = async (req, res, next) => {
  try {
    const { name, description, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Workspace name is required.',
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      color: color || '#5757d9',
      owner: req.user._id,
      members: [
        {
          user: req.user._id,
          role: 'Owner',
          joinedAt: new Date(),
        },
      ],
    });

    // Set as current workspace
    req.user.currentWorkspace = workspace._id;
    await req.user.save();

    // Log activity
    await Activity.create({
      workspace: workspace._id,
      user: req.user._id,
      action: 'created_workspace',
      details: `Created workspace "${workspace.name}"`,
    });

    res.status(201).json({
      success: true,
      message: 'Workspace created successfully.',
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get workspace details by ID
// @route   GET /api/workspaces/:id
// @access  Private
const getWorkspaceById = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar jobTitle');

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    // Verify user is a member
    const membership = workspace.members.find(
      (m) => m.user && m.user._id.toString() === req.user._id.toString()
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this workspace.',
      });
    }

    const projectsCount = await Project.countDocuments({ workspace: workspace._id });
    const tasksCount = await Task.countDocuments({ workspace: workspace._id });

    res.status(200).json({
      success: true,
      workspace: {
        ...workspace.toObject(),
        projectsCount,
        tasksCount,
        userRole: membership.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update workspace
// @route   PUT /api/workspaces/:id
// @access  Private (Owner/Admin)
const updateWorkspace = async (req, res, next) => {
  try {
    const { name, description, color } = req.body;
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const membership = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!membership || !['Owner', 'Admin'].includes(membership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners or admins can update workspace details.',
      });
    }

    if (name) workspace.name = name.trim();
    if (description !== undefined) workspace.description = description.trim();
    if (color) workspace.color = color;

    await workspace.save();

    res.status(200).json({
      success: true,
      message: 'Workspace updated successfully.',
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Join workspace via invite code
// @route   POST /api/workspaces/join
// @access  Private
const joinWorkspaceByInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, message: 'Invite code is required.' });
    }

    const workspace = await Workspace.findOne({ inviteCode });
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Invalid invite code.' });
    }

    // Check if user already a member
    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (isMember) {
      return res.status(200).json({
        success: true,
        message: 'You are already a member of this workspace.',
        workspace,
      });
    }

    workspace.members.push({
      user: req.user._id,
      role: 'Member',
      joinedAt: new Date(),
    });

    await workspace.save();

    // Set as current workspace
    req.user.currentWorkspace = workspace._id;
    await req.user.save();

    await Activity.create({
      workspace: workspace._id,
      user: req.user._id,
      action: 'joined_workspace',
      details: `${req.user.name} joined the workspace using an invite code.`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully joined ${workspace.name}!`,
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to workspace by email or direct user id
// @route   POST /api/workspaces/:id/members
// @access  Private (Owner/Admin)
const addWorkspaceMember = async (req, res, next) => {
  try {
    const { email, role = 'Member' } = req.body;
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const currentMembership = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!currentMembership || !['Owner', 'Admin'].includes(currentMembership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners or admins can add members.',
      });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Member email is required.' });
    }

    // Find user by email
    let userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
    let createdTemp = false;

    // If user does not exist yet, create a placeholder user account for them
    if (!userToAdd) {
      const generatedPassword = crypto.randomBytes(8).toString('hex');
      const inferredName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      userToAdd = await User.create({
        name: inferredName,
        email: email.toLowerCase().trim(),
        password: generatedPassword,
        jobTitle: 'Team Member',
      });
      createdTemp = true;
    }

    // Check if already a member
    const existingIndex = workspace.members.findIndex(
      (m) => m.user.toString() === userToAdd._id.toString()
    );

    if (existingIndex !== -1) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this workspace.',
      });
    }

    workspace.members.push({
      user: userToAdd._id,
      role: ['Owner', 'Admin', 'Member', 'Viewer'].includes(role) ? role : 'Member',
      joinedAt: new Date(),
    });

    await workspace.save();

    await Activity.create({
      workspace: workspace._id,
      user: req.user._id,
      action: 'invited_member',
      details: `${req.user.name} added ${userToAdd.name} (${userToAdd.email}) as ${role}.`,
    });

    const updatedWorkspace = await Workspace.findById(workspace._id).populate(
      'members.user',
      'name email avatar jobTitle'
    );

    res.status(200).json({
      success: true,
      message: createdTemp
        ? `Added ${userToAdd.name} to the team.`
        : `Added ${userToAdd.name} to the workspace!`,
      members: updatedWorkspace.members,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update member role
// @route   PUT /api/workspaces/:id/members/:userId
// @access  Private (Owner/Admin)
const updateMemberRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { id: workspaceId, userId } = req.params;

    if (!['Owner', 'Admin', 'Member', 'Viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const operatorMembership = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!operatorMembership || !['Owner', 'Admin'].includes(operatorMembership.role)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Must be Owner or Admin.',
      });
    }

    // Cannot demote the workspace primary owner
    if (workspace.owner.toString() === userId && role !== 'Owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot demote the primary workspace owner.',
      });
    }

    const targetMembership = workspace.members.find((m) => m.user.toString() === userId);
    if (!targetMembership) {
      return res.status(404).json({ success: false, message: 'Member not found in workspace.' });
    }

    targetMembership.role = role;
    await workspace.save();

    const updatedWorkspace = await Workspace.findById(workspaceId).populate(
      'members.user',
      'name email avatar jobTitle'
    );

    res.status(200).json({
      success: true,
      message: 'Member role updated successfully.',
      members: updatedWorkspace.members,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from workspace
// @route   DELETE /api/workspaces/:id/members/:userId
// @access  Private (Owner/Admin or self)
const removeWorkspaceMember = async (req, res, next) => {
  try {
    const { id: workspaceId, userId } = req.params;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    // Cannot remove the primary owner
    if (workspace.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the primary workspace owner.',
      });
    }

    const operatorMembership = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );

    const isSelf = req.user._id.toString() === userId;

    if (!isSelf && (!operatorMembership || !['Owner', 'Admin'].includes(operatorMembership.role))) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied to remove member.',
      });
    }

    workspace.members = workspace.members.filter((m) => m.user.toString() !== userId);
    await workspace.save();

    const updatedWorkspace = await Workspace.findById(workspaceId).populate(
      'members.user',
      'name email avatar jobTitle'
    );

    res.status(200).json({
      success: true,
      message: isSelf ? 'You have left the workspace.' : 'Member removed from workspace.',
      members: updatedWorkspace.members,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Regenerate invite code
// @route   POST /api/workspaces/:id/regenerate-invite
// @access  Private (Owner/Admin)
const regenerateInviteCode = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const membership = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString()
    );

    if (!membership || !['Owner', 'Admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Permission denied.' });
    }

    workspace.inviteCode = crypto.randomBytes(6).toString('hex');
    await workspace.save();

    res.status(200).json({
      success: true,
      message: 'Invite code regenerated.',
      inviteCode: workspace.inviteCode,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  joinWorkspaceByInvite,
  addWorkspaceMember,
  updateMemberRole,
  removeWorkspaceMember,
  regenerateInviteCode,
};
