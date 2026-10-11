const Project = require('../models/Project');
const Task = require('../models/Task');
const Activity = require('../models/Activity');

const isWorkspaceMember = (userId, workspace) => {
  if (!userId) return true;
  return workspace.members.some(
    (m) => (m.user?._id || m.user).toString() === userId.toString()
  );
};

// @desc    Get all projects for workspace
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res, next) => {
  try {
    const { search, status, category, sort, page, limit } = req.query;
    const filter = { workspace: req.workspace._id };

    if (status && status !== 'all') {
      filter.status = status;
    } else {
      // By default exclude archived unless asked
      if (status !== 'archived') {
        filter.status = { $ne: 'archived' };
      }
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { key: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOption = { updatedAt: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    if (sort === 'created') sortOption = { createdAt: -1 };
    if (sort === 'targetDate') sortOption = { targetDate: 1 };

    const total = await Project.countDocuments(filter);

    let query = Project.find(filter)
      .populate('lead', 'name email avatar jobTitle')
      .populate('members', 'name email avatar jobTitle')
      .sort(sortOption);

    if (page && limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 20);
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const projects = await query;

    // Compute task counts & completion metrics per project
    const projectsWithMetrics = await Promise.all(
      projects.map(async (project) => {
        const tasks = await Task.find({ project: project._id });
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter((t) => t.status === 'done').length;
        const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
        const inReviewTasks = tasks.filter((t) => t.status === 'in_review').length;
        const todoTasks = tasks.filter((t) => t.status === 'todo').length;
        const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        return {
          ...project.toObject(),
          stats: {
            total: totalTasks,
            done: doneTasks,
            inProgress: inProgressTasks,
            inReview: inReviewTasks,
            todo: todoTasks,
            completionRate,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      total,
      count: projectsWithMetrics.length,
      page: page ? parseInt(page, 10) : 1,
      totalPages: limit ? Math.ceil(total / parseInt(limit, 10)) : 1,
      projects: projectsWithMetrics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single project by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    })
      .populate('lead', 'name email avatar jobTitle')
      .populate('members', 'name email avatar jobTitle');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this workspace.',
      });
    }

    const tasks = await Task.find({ project: project._id });
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    res.status(200).json({
      success: true,
      project: {
        ...project.toObject(),
        stats: {
          total,
          done,
          inProgress: tasks.filter((t) => t.status === 'in_progress').length,
          inReview: tasks.filter((t) => t.status === 'in_review').length,
          todo: tasks.filter((t) => t.status === 'todo').length,
          completionRate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res, next) => {
  try {
    const { name, key, description, category, lead, members, targetDate, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    if (lead && !isWorkspaceMember(lead, req.workspace)) {
      return res.status(400).json({
        success: false,
        message: 'Project lead must be a member of this workspace.',
      });
    }

    if (members && Array.isArray(members)) {
      for (const m of members) {
        if (!isWorkspaceMember(m, req.workspace)) {
          return res.status(400).json({
            success: false,
            message: 'All project members must belong to this workspace.',
          });
        }
      }
    }

    // Auto-generate project key if missing (e.g. PRJ-101)
    let projectKey = key ? key.trim().toUpperCase() : '';
    if (!projectKey) {
      const initials = name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
      const count = await Project.countDocuments({ workspace: req.workspace._id });
      projectKey = `${initials || 'PRJ'}-${count + 101}`;
    }

    // Check key uniqueness in workspace
    const existingKey = await Project.findOne({
      workspace: req.workspace._id,
      key: projectKey,
    });

    if (existingKey) {
      projectKey = `${projectKey}-${Math.floor(10 + Math.random() * 90)}`;
    }

    const project = await Project.create({
      name: name.trim(),
      key: projectKey,
      description: description ? description.trim() : '',
      workspace: req.workspace._id,
      category: category || 'Design & Eng',
      color: color || '#5757d9',
      icon: icon || 'folder',
      lead: lead || req.user._id,
      members: members && Array.isArray(members) && members.length > 0 ? members : [req.user._id],
      targetDate: targetDate || null,
    });

    await Activity.create({
      workspace: req.workspace._id,
      project: project._id,
      user: req.user._id,
      action: 'created_project',
      details: `${req.user.name} created project "${project.name}" (${project.key})`,
    });

    const populated = await Project.findById(project._id)
      .populate('lead', 'name email avatar jobTitle')
      .populate('members', 'name email avatar jobTitle');

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this workspace.',
      });
    }

    // Viewers cannot update projects
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers are not permitted to modify projects.',
      });
    }

    const { name, description, category, status, lead, members, targetDate, color, icon, isStarred } = req.body;

    if (lead !== undefined && lead !== null && !isWorkspaceMember(lead, req.workspace)) {
      return res.status(400).json({
        success: false,
        message: 'Project lead must be a member of this workspace.',
      });
    }

    if (members && Array.isArray(members)) {
      for (const m of members) {
        if (!isWorkspaceMember(m, req.workspace)) {
          return res.status(400).json({
            success: false,
            message: 'All project members must belong to this workspace.',
          });
        }
      }
    }

    const oldStatus = project.status;
    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    if (category) project.category = category;
    if (status) project.status = status;
    if (lead !== undefined) project.lead = lead;
    if (members) project.members = members;
    if (targetDate !== undefined) project.targetDate = targetDate;
    if (color) project.color = color;
    if (icon) project.icon = icon;
    if (isStarred !== undefined) project.isStarred = isStarred;

    await project.save();

    if (status && status !== oldStatus) {
      await Activity.create({
        workspace: req.workspace._id,
        project: project._id,
        user: req.user._id,
        action: 'updated_project',
        details: `${req.user.name} updated project "${project.name}" status to ${status}`,
      });
    }

    const populated = await Project.findById(project._id)
      .populate('lead', 'name email avatar jobTitle')
      .populate('members', 'name email avatar jobTitle');

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      project: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive / unarchive project
// @route   PUT /api/projects/:id/archive
// @access  Private
const archiveProject = async (req, res, next) => {
  try {
    if (req.workspaceRole === 'Viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot archive projects.',
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this workspace.',
      });
    }

    const newStatus = project.status === 'archived' ? 'in_progress' : 'archived';
    project.status = newStatus;
    await project.save();

    await Activity.create({
      workspace: req.workspace._id,
      project: project._id,
      user: req.user._id,
      action: 'updated_project',
      details: `${req.user.name} ${newStatus === 'archived' ? 'archived' : 'unarchived'} project "${project.name}"`,
    });

    const populated = await Project.findById(project._id)
      .populate('lead', 'name email avatar jobTitle')
      .populate('members', 'name email avatar jobTitle');

    res.status(200).json({
      success: true,
      message: `Project ${newStatus === 'archived' ? 'archived' : 'unarchived'} successfully.`,
      project: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (Owner/Admin)
const deleteProject = async (req, res, next) => {
  try {
    if (!['Owner', 'Admin'].includes(req.workspaceRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only workspace owners or admins can delete projects.',
      });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      workspace: req.workspace._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this workspace.',
      });
    }

    // Delete tasks belonging to project
    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    await Activity.create({
      workspace: req.workspace._id,
      user: req.user._id,
      action: 'deleted_project',
      details: `${req.user.name} deleted project "${project.name}" (${project.key})`,
    });

    res.status(200).json({
      success: true,
      message: 'Project and associated tasks deleted.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject,
  deleteProject,
};
