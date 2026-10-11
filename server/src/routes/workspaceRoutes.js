const express = require('express');
const {
  getWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  joinWorkspaceByInvite,
  addWorkspaceMember,
  updateMemberRole,
  removeWorkspaceMember,
  regenerateInviteCode,
} = require('../controllers/workspaceController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/').get(getWorkspaces).post(createWorkspace);
router.post('/join', joinWorkspaceByInvite);
router.route('/:id').get(getWorkspaceById).put(updateWorkspace);
router.post('/:id/members', addWorkspaceMember);
router.put('/:id/members/:userId', updateMemberRole);
router.delete('/:id/members/:userId', removeWorkspaceMember);
router.post('/:id/regenerate-invite', regenerateInviteCode);

module.exports = router;
