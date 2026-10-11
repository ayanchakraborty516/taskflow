const Project = require('../models/Project');
const Task = require('../models/Task');
const Activity = require('../models/Activity');

// @desc    Get dashboard metrics & summary data
// @route   GET /api/dashboard
// @access  Private
const getDashboardSummary = async (req, res, next) => {
  try {
    const workspaceId = req.workspace._id;
    const userId = req.user._id;

    // 1. Active Projects Count
    const activeProjectsCount = await Project.countDocuments({
      workspace: workspaceId,
      status: { $ne: 'archived' },
    });

    // 2. All Tasks for workspace
    const allWorkspaceTasks = await Task.find({ workspace: workspaceId })
      .populate('project', 'name key color')
      .populate('assignee', 'name email avatar jobTitle');

    // 3. User's Assigned Tasks
    const myTasks = allWorkspaceTasks.filter(
      (t) => t.assignee && t.assignee._id.toString() === userId.toString()
    );

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // My tasks breakdown
    const myTasksDueToday = myTasks.filter((t) => {
      if (!t.dueDate || t.status === 'done') return false;
      const due = new Date(t.dueDate);
      return due >= startOfToday && due <= endOfToday;
    }).length;

    const myTasksInProgress = myTasks.filter((t) => t.status === 'in_progress').length;

    // Completed this week
    const completedThisWeek = allWorkspaceTasks.filter((t) => {
      if (t.status !== 'done') return false;
      const updated = new Date(t.updatedAt);
      return updated >= sevenDaysAgo;
    }).length;

    // Overdue tasks
    const overdueTasks = allWorkspaceTasks.filter((t) => {
      if (t.status === 'done' || !t.dueDate) return false;
      return new Date(t.dueDate) < startOfToday;
    });

    // Priority Tasks list for user (or workspace if user has few)
    let priorityTasks = myTasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const pOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      })
      .slice(0, 6);

    if (priorityTasks.length < 5) {
      const otherPriorityTasks = allWorkspaceTasks
        .filter((t) => t.status !== 'done' && !priorityTasks.some((pt) => pt._id.toString() === t._id.toString()))
        .sort((a, b) => {
          const pOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        })
        .slice(0, 6 - priorityTasks.length);
      priorityTasks = [...priorityTasks, ...otherPriorityTasks];
    }

    // Status breakdown across workspace
    const statusCounts = {
      todo: allWorkspaceTasks.filter((t) => t.status === 'todo').length,
      in_progress: allWorkspaceTasks.filter((t) => t.status === 'in_progress').length,
      in_review: allWorkspaceTasks.filter((t) => t.status === 'in_review').length,
      done: allWorkspaceTasks.filter((t) => t.status === 'done').length,
    };

    const totalTasks = allWorkspaceTasks.length;
    const velocityRate = totalTasks > 0 ? Math.round((statusCounts.done / totalTasks) * 100) : 0;

    // Upcoming Deadlines (tasks due today or in the future, sorted by dueDate ascending)
    const upcomingDeadlines = allWorkspaceTasks
      .filter((t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate) >= startOfToday)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 6);

    // 7-Day Completion Velocity Chart (real counts of tasks completed on each day)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const completionChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const count = allWorkspaceTasks.filter((t) => {
        if (t.status !== 'done') return false;
        const u = new Date(t.updatedAt);
        return u >= dayStart && u <= dayEnd;
      }).length;

      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      completionChart.push({
        date: dateStr,
        day: dayNames[d.getDay()],
        completed: count,
      });
    }

    // Recent activity (latest 8)
    const recentActivity = await Activity.find({ workspace: workspaceId })
      .populate('user', 'name email avatar jobTitle')
      .populate('project', 'name key color')
      .populate('task', 'title key')
      .sort({ createdAt: -1 })
      .limit(8);

    // Active project highlights
    const activeProjects = await Project.find({
      workspace: workspaceId,
      status: { $ne: 'archived' },
    })
      .populate('lead', 'name email avatar')
      .populate('members', 'name email avatar')
      .sort({ updatedAt: -1 })
      .limit(4);

    const activeProjectsWithProgress = activeProjects.map((p) => {
      const pTasks = allWorkspaceTasks.filter((t) => t.project && t.project._id.toString() === p._id.toString());
      const pDone = pTasks.filter((t) => t.status === 'done').length;
      return {
        ...p.toObject(),
        taskCount: pTasks.length,
        progress: pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0,
      };
    });

    res.status(200).json({
      success: true,
      summary: {
        activeProjectsCount,
        myTasksCount: myTasks.length,
        myTasksDueToday,
        myTasksInProgress,
        completedTasksCount: allWorkspaceTasks.filter((t) => t.status === 'done').length,
        completedThisWeek,
        overdueCount: overdueTasks.length,
        velocityRate,
        statusCounts,
        totalTasksCount: allWorkspaceTasks.length,
      },
      priorityTasks,
      upcomingDeadlines,
      completionChart,
      recentActivity,
      activeProjects: activeProjectsWithProgress,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardSummary };
