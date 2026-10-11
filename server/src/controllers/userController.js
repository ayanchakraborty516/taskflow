const User = require('../models/User');
const Workspace = require('../models/Workspace');

// @desc    Get workspace members or search users
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res, next) => {
  try {
    const { search, workspaceId } = req.query;
    let query = { isActive: true };

    if (workspaceId) {
      const workspace = await Workspace.findById(workspaceId);
      if (workspace) {
        const memberIds = workspace.members.map((m) => m.user);
        query._id = { $in: memberIds };
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).select('name email avatar jobTitle');
    res.status(200).json({ success: true, count: users.length, users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by id
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email avatar jobTitle createdAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
};
