const express = require('express');
const { getUsers, getUserById } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getUsers);
router.get('/:id', getUserById);

module.exports = router;
