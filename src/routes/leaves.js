const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { validateLeaveRequest } = require('../middleware/validation');
const { authMiddleware } = require('../middleware/auth');

// Routes protégées
router.use(authMiddleware);

router.get('/balance', leaveController.getBalance);
router.post('/request', validateLeaveRequest, leaveController.createRequest);
router.get('/requests', leaveController.getRequests);
router.get('/stats', leaveController.getStats);

module.exports = router;