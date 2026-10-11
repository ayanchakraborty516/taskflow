const express = require('express');
const {
  getCommentsByTask,
  addComment,
  deleteComment,
} = require('../controllers/commentController');
const { protect } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

const router = express.Router();

router.use(protect);
router.use(requireWorkspace);

router.get('/task/:taskId', getCommentsByTask);
router.post('/', addComment);
router.delete('/:id', deleteComment);

module.exports = router;
