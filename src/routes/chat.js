const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { validateFeedback, validateObjectId } = require('../middleware/validation');
const { authMiddleware } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimit');

// Routes protégées
router.use(authMiddleware);

router.get('/conversations', chatController.getConversations);
router.get('/conversations/:conversationId/messages', 
  validateObjectId('conversationId'), 
  chatController.getMessages
);
router.post('/feedback', chatLimiter, validateFeedback, chatController.saveFeedback);
router.put('/conversations/:conversationId/archive', 
  validateObjectId('conversationId'), 
  chatController.archiveConversation
);

module.exports = router;