const Activity = require('../models/Activity');

// @desc    Get activity feed for workspace or project
// @route   GET /api/activity
// @access  Private
const getActivity = async (req, res, next) => {
  try {
    const { project, limit = 30 } = req.query;
    const filter = { workspace: req.workspace._id };

    if (project) {
      filter.project = project;
    }

    const activities = await Activity.find(filter)
      .populate('user', 'name email avatar jobTitle')
      .populate('project', 'name key color')
      .populate('task', 'title key')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    res.status(200).json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getActivity };
