const express = require('express');
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  archiveProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

const router = express.Router();

router.use(protect);
router.use(requireWorkspace);

router.route('/').get(getProjects).post(createProject);
router.route('/:id').get(getProjectById).put(updateProject).delete(deleteProject);
router.put('/:id/archive', archiveProject);

module.exports = router;
