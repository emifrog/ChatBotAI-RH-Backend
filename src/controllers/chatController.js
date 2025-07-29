const chatService = require('../services/chatService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

class ChatController {
  // Récupérer les conversations d'un utilisateur
  async getConversations(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const conversations = await chatService.getUserConversations(userId, limit);
      
      res.json({
        success: true,
        data: { conversations }
      });
    } catch (error) {
      logger.logError(error, { context: 'getConversations', userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des conversations'
      });
    }
  }

  // Récupérer les messages d'une conversation
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      const messages = await chatService.getConversationMessages(conversationId, limit);
      
      res.json({
        success: true,
        data: { messages }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'getMessages', 
        conversationId: req.params.conversationId,
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des messages'
      });
    }
  }

  // Sauvegarder un feedback
  async saveFeedback(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const feedbackData = {
        ...req.body,
        userId: req.user.id
      };

      const feedback = await chatService.saveFeedback(feedbackData);
      
      res.status(201).json({
        success: true,
        message: 'Feedback enregistré',
        data: { feedback }
      });
    } catch (error) {
      logger.logError(error, { context: 'saveFeedback', userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'enregistrement du feedback'
      });
    }
  }

  // Archiver une conversation
  async archiveConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;

      const conversation = await chatService.archiveConversation(conversationId, userId);
      
      res.json({
        success: true,
        message: 'Conversation archivée',
        data: { conversation }
      });
    } catch (error) {
      logger.logError(error, { 
        context: 'archiveConversation', 
        conversationId: req.params.conversationId,
        userId: req.user?.id 
      });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'archivage'
      });
    }
  }
}

module.exports = new ChatController();