const express = require('express');
const { getDashboardSummary } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

const router = express.Router();

router.use(protect);
router.use(requireWorkspace);

router.get('/', getDashboardSummary);

module.exports = router;
