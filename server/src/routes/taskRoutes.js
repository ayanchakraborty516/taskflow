const express = require('express');
const {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  moveTask,
  reorderTasks,
  deleteTask,
  toggleSubtask,
} = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

const router = express.Router();

router.use(protect);
router.use(requireWorkspace);

router.route('/').get(getTasks).post(createTask);
router.post('/reorder', reorderTasks);
router.route('/:id').get(getTaskById).put(updateTask).delete(deleteTask);
router.post('/:id/move', moveTask);
router.put('/:id/subtasks/:subtaskId', toggleSubtask);

module.exports = router;
