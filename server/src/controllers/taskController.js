const Task = require('../models/Task');
const Project = require('../models/Project');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

const isWorkspaceMember = (userId, workspace) => {
  if (!userId) return true;
  return workspace.members.some(
    (m) => (m.user?._id || m.user).toString() === userId.toString()
  );
};

const VALID_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// @desc    Get all tasks for workspace (with optional filters)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res, next) => {
  try {
    const { project, assignee, status, priority, search, myTasks, page, limit, sort } = req.query;
    const filter = { workspace: req.workspace._id };

    if (project) {
      filter.project = project;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    if (assignee) {
      filter.assignee = assignee;
    }

    if (myTasks === 'true') {
      filter.assignee = req.user._id;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { key: { $regex: search, $options: 'i' } },
        { labels: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOption = { order: 1, createdAt: -1 };
    if (sort === 'dueDate') sortOption = { dueDate: 1 };
    if (sort === 'priority') sortOption = { priority: -1 };
    if (sort === 'title') sortOption = { title: 1 };
    if (sort === 'created') sortOption = { createdAt: -1 };

    const total = await Task.countDocuments(filter);

    let query = Task.find(filter)
      .populate('project', 'name key color')
      .populate('assignee', 'name email avatar jobTitle')
      .populate('creator', 'name email avatar')
      .sort(sortOption);

    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const tasks = await query;

    res.status(200).json({
      success: true,
      total,
      count: tasks.length,
      page: page ? parseInt(page, 10) : 1,
      totalPages: limit ? Math.ceil(total / parseInt(limit, 10)) : 1,
      tasks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    })
      .populate('project', 'name key color lead')
      .populate('assignee', 'name email avatar jobTitle')
      .populate('creator', 'name email avatar');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found in this workspace.',
      });
    }

    res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot create tasks.',
      });
    }

    const {
      title,
      description,
      project: projectId,
      status = 'todo',
      priority = 'medium',
      assignee,
      dueDate,
      labels = [],
      subtasks = [],
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project is required.' });
    }

    if (assignee && !isWorkspaceMember(assignee, req.workspace)) {
      return res.status(400).json({
        success: false,
        message: 'Task assignee must be a member of this workspace.',
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`,
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      workspace: req.workspace._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this workspace.',
      });
    }

    // Generate task key (e.g. MOB-101 or PRJ-102)
    const taskCount = await Task.countDocuments({ project: project._id });
    const taskKey = `${project.key || 'TSK'}-${taskCount + 101}`;

    // Compute max order for column
    const highestOrderTask = await Task.findOne({
      workspace: req.workspace._id,
      project: project._id,
      status,
    }).sort({ order: -1 });

    const nextOrder = highestOrderTask ? highestOrderTask.order + 1 : 0;

    const task = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : '',
      key: taskKey,
      workspace: req.workspace._id,
      project: project._id,
      status,
      priority,
      assignee: assignee || null,
      creator: req.user._id,
      dueDate: dueDate || null,
      labels: Array.isArray(labels) ? labels.map((l) => l.trim()).filter(Boolean) : [],
      order: nextOrder,
      subtasks: Array.isArray(subtasks) ? subtasks : [],
    });

    // Record activity
    await Activity.create({
      workspace: req.workspace._id,
      project: project._id,
      task: task._id,
      user: req.user._id,
      action: 'created_task',
      details: `${req.user.name} created task "${task.title}" (${task.key})`,
    });

    // Notify assignee if not the creator
    if (assignee && assignee.toString() !== req.user._id.toString()) {
      await Notification.create({
        workspace: req.workspace._id,
        recipient: assignee,
        sender: req.user._id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${req.user.name} assigned you to "${task.title}" (${task.key})`,
        link: `/projects/${project._id}/board?taskId=${task._id}`,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('project', 'name key color')
      .populate('assignee', 'name email avatar jobTitle')
      .populate('creator', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      task: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers are not permitted to modify tasks.',
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found in this workspace.',
      });
    }

    const oldStatus = task.status;
    const oldAssignee = task.assignee?.toString();

    const {
      title,
      description,
      status,
      priority,
      assignee,
      dueDate,
      labels,
      order,
      subtasks,
    } = req.body;

    if (assignee !== undefined && assignee !== null && !isWorkspaceMember(assignee, req.workspace)) {
      return res.status(400).json({
        success: false,
        message: 'Task assignee must be a member of this workspace.',
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`,
      });
    }

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignee !== undefined) task.assignee = assignee || null;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    if (labels !== undefined) task.labels = labels;
    if (order !== undefined) task.order = order;
    if (subtasks !== undefined) task.subtasks = subtasks;

    await task.save();

    // Log status change activity if changed
    if (status && status !== oldStatus) {
      await Activity.create({
        workspace: req.workspace._id,
        project: task.project,
        task: task._id,
        user: req.user._id,
        action: 'status_changed',
        details: `${req.user.name} moved "${task.title}" to ${status.replace('_', ' ')}`,
      });

      if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
        await Notification.create({
          workspace: req.workspace._id,
          recipient: task.assignee,
          sender: req.user._id,
          type: 'task_status',
          title: 'Task Status Updated',
          message: `${req.user.name} updated status of "${task.title}" to ${status.replace('_', ' ')}`,
          link: `/projects/${task.project}/board?taskId=${task._id}`,
        });
      }
    }

    // Log assignee change if changed
    if (assignee && assignee.toString() !== oldAssignee && assignee.toString() !== req.user._id.toString()) {
      await Notification.create({
        workspace: req.workspace._id,
        recipient: assignee,
        sender: req.user._id,
        type: 'task_assigned',
        title: 'Task Reassigned',
        message: `${req.user.name} assigned you to "${task.title}" (${task.key})`,
        link: `/projects/${task.project}/board?taskId=${task._id}`,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('project', 'name key color')
      .populate('assignee', 'name email avatar jobTitle')
      .populate('creator', 'name email avatar');

    res.status(200).json({
      success: true,
      message: 'Task updated successfully.',
      task: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Move task / update status & order in column
// @route   POST /api/tasks/:id/move
// @access  Private
const moveTask = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot move tasks.',
      });
    }

    const { status, newOrder, order } = req.body;
    const task = await Task.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in this workspace.' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const oldStatus = task.status;
    if (status) task.status = status;
    const finalOrder = newOrder !== undefined ? newOrder : order;
    if (finalOrder !== undefined) task.order = finalOrder;

    await task.save();

    if (status && status !== oldStatus) {
      await Activity.create({
        workspace: req.workspace._id,
        project: task.project,
        task: task._id,
        user: req.user._id,
        action: 'status_changed',
        details: `${req.user.name} moved "${task.title}" to ${status.replace('_', ' ')}`,
      });

      if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
        await Notification.create({
          workspace: req.workspace._id,
          recipient: task.assignee,
          sender: req.user._id,
          type: 'task_status',
          title: 'Task Status Updated',
          message: `${req.user.name} updated status of "${task.title}" to ${status.replace('_', ' ')}`,
          link: `/projects/${task.project}/board?taskId=${task._id}`,
        });
      }
    }

    const populated = await Task.findById(task._id)
      .populate('project', 'name key color')
      .populate('assignee', 'name email avatar jobTitle')
      .populate('creator', 'name email avatar');

    res.status(200).json({
      success: true,
      message: 'Task moved successfully.',
      task: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch reorder tasks in or between columns
// @route   POST /api/tasks/reorder
// @access  Private
const reorderTasks = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot reorder tasks.',
      });
    }

    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ success: false, message: 'Tasks array is required.' });
    }

    const bulkOps = tasks.map((t) => ({
      updateOne: {
        filter: { _id: t.id || t._id, workspace: req.workspace._id },
        update: {
          $set: {
            ...(t.status ? { status: t.status } : {}),
            ...(t.order !== undefined ? { order: t.order } : {}),
          },
        },
      },
    }));

    await Task.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Tasks reordered successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot delete tasks.',
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found in this workspace.',
      });
    }

    await task.deleteOne();

    await Activity.create({
      workspace: req.workspace._id,
      project: task.project,
      user: req.user._id,
      action: 'deleted_task',
      details: `${req.user.name} deleted task "${task.title}" (${task.key})`,
    });

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle subtask completion
// @route   PUT /api/tasks/:id/subtasks/:subtaskId
// @access  Private
const toggleSubtask = async (req, res, next) => {
  try {
    const { id, subtaskId } = req.params;
    const task = await Task.findOne({ _id: id, workspace: req.workspace._id });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) {
      return res.status(404).json({ success: false, message: 'Subtask not found.' });
    }

    subtask.completed = !subtask.completed;
    await task.save();

    res.status(200).json({
      success: true,
      subtasks: task.subtasks,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  moveTask,
  reorderTasks,
  deleteTask,
  toggleSubtask,
};
