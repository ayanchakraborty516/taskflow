const express = require('express');
const { getActivity } = require('../controllers/activityController');
const { protect } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

const router = express.Router();

router.use(protect);
router.use(requireWorkspace);

router.get('/', getActivity);

module.exports = router;
