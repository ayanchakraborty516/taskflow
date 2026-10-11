const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');

// @desc    Get comments for a task
// @route   GET /api/comments/task/:taskId
// @access  Private
const getCommentsByTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findOne({ _id: taskId, workspace: req.workspace._id });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in this workspace.' });
    }

    const comments = await Comment.find({ task: taskId, workspace: req.workspace._id })
      .populate('author', 'name email avatar jobTitle')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, count: comments.length, comments });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to task
// @route   POST /api/comments
// @access  Private
const addComment = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({ success: false, message: 'Viewers cannot add comments.' });
    }

    const { task: taskId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content cannot be empty.' });
    }

    const task = await Task.findOne({ _id: taskId, workspace: req.workspace._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in workspace.' });
    }

    const comment = await Comment.create({
      task: taskId,
      workspace: req.workspace._id,
      author: req.user._id,
      content: content.trim(),
    });

    await Activity.create({
      workspace: req.workspace._id,
      project: task.project,
      task: task._id,
      user: req.user._id,
      action: 'added_comment',
      details: `${req.user.name} commented on "${task.title}"`,
    });

    // Notify assignee or creator if they are not the author
    const recipientsToNotify = [task.assignee, task.creator].filter(
      (u) => u && u.toString() !== req.user._id.toString()
    );

    for (const recipientId of new Set(recipientsToNotify.map((id) => id.toString()))) {
      const isRecipientMember = req.workspace.members.some(
        (m) => (m.user?._id || m.user).toString() === recipientId.toString()
      );
      if (isRecipientMember) {
        await Notification.create({
          workspace: req.workspace._id,
          recipient: recipientId,
          sender: req.user._id,
          type: 'comment_added',
          title: 'New Comment on Task',
          message: `${req.user.name} commented on "${task.title}": "${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
          link: `/projects/${task.project}/board?taskId=${task._id}`,
        });
      }
    }

    const populated = await Comment.findById(comment._id).populate(
      'author',
      'name email avatar jobTitle'
    );

    res.status(201).json({
      success: true,
      message: 'Comment added.',
      comment: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    // Only author or Owner/Admin can delete comment
    const isAuthor = comment.author.toString() === req.user._id.toString();
    const isOwnerOrAdmin = ['Owner', 'Admin'].includes(req.workspaceRole);

    if (!isAuthor && !isOwnerOrAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete comment.' });
    }

    await comment.deleteOne();

    res.status(200).json({ success: true, message: 'Comment deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommentsByTask,
  addComment,
  deleteComment,
};
