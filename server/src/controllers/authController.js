const User = require('../models/User');
const Workspace = require('../models/Workspace');
const { sendTokenResponse } = require('../utils/token');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, workspaceName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    // Create default workspace for new user
    const initialWorkspaceName = workspaceName?.trim() || `${user.name.split(' ')[0]}'s Workspace`;
    const workspace = await Workspace.create({
      name: initialWorkspaceName,
      owner: user._id,
      members: [
        {
          user: user._id,
          role: 'Owner',
          joinedAt: new Date(),
        },
      ],
    });

    // Set current workspace
    user.currentWorkspace = workspace._id;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 201, res, 'Registration successful.');
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Ensure user has a current workspace
    if (!user.currentWorkspace) {
      const firstWorkspace = await Workspace.findOne({ 'members.user': user._id });
      if (firstWorkspace) {
        user.currentWorkspace = firstWorkspace._id;
        await user.save({ validateBeforeSave: false });
      }
    }

    sendTokenResponse(user, 200, res, 'Logged in successfully.');
  } catch (error) {
    next(error);
  }
};

// @desc    Log out user & clear cookie
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSameSite = process.env.COOKIE_SAMESITE || (isProduction ? 'strict' : 'lax');

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: cookieSameSite,
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully.',
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const workspaces = await Workspace.find({ 'members.user': user._id }).select('name slug color members owner');

    res.status(200).json({
      success: true,
      user,
      workspaces: workspaces.map((w) => {
        const membership = w.members.find((m) => m.user.toString() === user._id.toString());
        return {
          _id: w._id,
          name: w.name,
          slug: w.slug,
          color: w.color,
          isOwner: w.owner.toString() === user._id.toString(),
          role: membership ? membership.role : 'Member',
          membersCount: w.members.length,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar, jobTitle, currentWorkspace } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (jobTitle) user.jobTitle = jobTitle.trim();

    if (currentWorkspace) {
      // Validate workspace membership
      const ws = await Workspace.findOne({
        _id: currentWorkspace,
        'members.user': user._id,
      });
      if (ws) {
        user.currentWorkspace = ws._id;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new passwords.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password.',
      });
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password changed successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
};
