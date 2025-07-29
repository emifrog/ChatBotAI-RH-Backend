const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');
const logger = require('../config/logger');

const prisma = new PrismaClient();

class ChatService {
  // Créer ou récupérer une conversation
  async getOrCreateConversation(userId, title = null) {
    try {
      // Chercher une conversation active
      let conversation = await prisma.conversation.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        },
        orderBy: { lastActivityAt: 'desc' }
      });

      if (!conversation) {
        // Créer une nouvelle conversation
        conversation = await prisma.conversation.create({
          data: {
            userId,
            title: title || `Conversation ${new Date().toLocaleDateString('fr-FR')}`,
            status: 'ACTIVE'
          }
        });
      }

      return conversation;
    } catch (error) {
      logger.logError(error, { context: 'getOrCreateConversation', userId });
      throw error;
    }
  }

  // Sauvegarder un message
  async saveMessage(messageData) {
    try {
      const message = await prisma.message.create({
        data: {
          conversationId: messageData.conversationId,
          userId: messageData.userId || null,
          type: messageData.type,
          content: messageData.content,
          intent: messageData.intent || null,
          confidence: messageData.confidence || null,
          entities: messageData.entities || null,
          antibiaData: messageData.antibiaData || null,
          actions: messageData.actions || null,
          metadata: messageData.metadata || null,
          timestamp: messageData.timestamp || new Date()
        }
      });

      // Mettre à jour l'activité de la conversation
      await prisma.conversation.update({
        where: { id: messageData.conversationId },
        data: { lastActivityAt: new Date() }
      });

      // Log pour analytics
      logger.logChat(messageData.userId, 'message_saved', {
        messageId: message.id,
        type: messageData.type,
        intent: messageData.intent
      });

      return message;
    } catch (error) {
      logger.logError(error, { context: 'saveMessage' });
      throw error;
    }
  }

  // Récupérer les messages d'une conversation
  async getConversationMessages(conversationId, limit = 50) {
    try {
      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { timestamp: 'asc' },
        take: limit,
        include: {
          user: {
            select: { id: true, name: true }
          },
          feedbacks: true
        }
      });

      return messages;
    } catch (error) {
      logger.logError(error, { context: 'getConversationMessages', conversationId });
      throw error;
    }
  }

  // Sauvegarder un feedback
  async saveFeedback(feedbackData) {
    try {
      const feedback = await prisma.feedback.create({
        data: {
          messageId: feedbackData.messageId,
          userId: feedbackData.userId,
          type: feedbackData.type,
          rating: feedbackData.rating || null,
          comment: feedbackData.comment || null,
          metadata: feedbackData.metadata || null
        }
      });

      logger.logChat(feedbackData.userId, 'feedback_saved', {
        messageId: feedbackData.messageId,
        type: feedbackData.type,
        rating: feedbackData.rating
      });

      return feedback;
    } catch (error) {
      logger.logError(error, { context: 'saveFeedback' });
      throw error;
    }
  }

  // Log d'intention NLP
  async logIntent(intentData) {
    try {
      const log = await prisma.intentLog.create({
        data: {
          userId: intentData.userId,
          messageId: intentData.messageId || null,
          userMessage: intentData.userMessage,
          detectedIntent: intentData.detectedIntent,
          confidence: intentData.confidence,
          entities: intentData.entities || null,
          processingTime: intentData.processingTime,
          nlpProvider: intentData.nlpProvider,
          success: intentData.success || true,
          errorMessage: intentData.errorMessage || null
        }
      });

      return log;
    } catch (error) {
      logger.logError(error, { context: 'logIntent' });
      throw error;
    }
  }

  // Récupérer l'historique des conversations d'un utilisateur
  async getUserConversations(userId, limit = 10) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: { lastActivityAt: 'desc' },
        take: limit,
        include: {
          messages: {
            take: 1,
            orderBy: { timestamp: 'desc' },
            select: {
              content: true,
              type: true,
              timestamp: true
            }
          },
          _count: {
            select: { messages: true }
          }
        }
      });

      return conversations;
    } catch (error) {
      logger.logError(error, { context: 'getUserConversations', userId });
      throw error;
    }
  }

  // Archiver une conversation
  async archiveConversation(conversationId, userId) {
    try {
      const conversation = await prisma.conversation.update({
        where: {
          id: conversationId,
          userId // S'assurer que l'utilisateur possède la conversation
        },
        data: {
          status: 'ARCHIVED',
          endedAt: new Date()
        }
      });

      logger.logChat(userId, 'conversation_archived', { conversationId });
      return conversation;
    } catch (error) {
      logger.logError(error, { context: 'archiveConversation', conversationId, userId });
      throw error;
    }
  }
}

module.exports = new ChatService();