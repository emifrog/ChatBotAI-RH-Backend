const chatService = require('../services/chatService');
const leaveService = require('../services/leaveService');
const payrollService = require('../services/payrollService');
const trainingService = require('../services/trainingService');
const logger = require('../config/logger');

class ChatHandler {
  constructor(io, redis) {
    this.io = io;
    this.redis = redis;
    this.nlpService = this.initializeNLP();
  }

  // Initialiser le service NLP simple
  initializeNLP() {
    return {
      // Classification basique d'intentions
      classifyIntent: (message) => {
        const text = message.toLowerCase();
        const intents = {
          'leave_request': ['congé', 'vacances', 'absence', 'jour off', 'repos'],
          'leave_balance': ['solde', 'reste', 'combien', 'jours restant'],
          'payroll': ['salaire', 'bulletin', 'paie', 'rémunération', 'fiche de paie'],
          'training': ['formation', 'cours', 'apprentissage', 'skill', 'développement'],
          'help': ['aide', 'help', 'comment', 'pourquoi', '?'],
          'greeting': ['bonjour', 'salut', 'hello', 'bonsoir', 'hey']
        };

        for (const [intent, keywords] of Object.entries(intents)) {
          if (keywords.some(keyword => text.includes(keyword))) {
            return { intent, confidence: 0.8 };
          }
        }

        return { intent: 'general', confidence: 0.5 };
      },

      // Extraction d'entités basique
      extractEntities: (message) => {
        const entities = {};
        
        // Extraction de dates
        const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}|demain|lundi|mardi|mercredi|jeudi|vendredi)/gi;
        const dates = message.match(dateRegex);
        if (dates) entities.dates = dates;
        
        // Extraction de durées
        const durationRegex = /(\d+)\s*(jour|jours|semaine|semaines)/gi;
        const durations = message.match(durationRegex);
        if (durations) entities.durations = durations;
        
        return entities;
      }
    };
  }

  // Gestionnaire principal pour une connexion Socket
  handleConnection(socket) {
    logger.info('User connected to chat', { 
      userId: socket.userId, 
      socketId: socket.id 
    });

    // Rejoindre la room de l'utilisateur
    socket.join(`user_${socket.userId}`);

    // Gestionnaire de message
    socket.on('send_message', async (data) => {
      await this.handleMessage(socket, data);
    });

    // Gestionnaire d'action rapide
    socket.on('quick_action', async (data) => {
      await this.handleQuickAction(socket, data);
    });

    // Gestionnaire de feedback
    socket.on('message_feedback', async (data) => {
      await this.handleFeedback(socket, data);
    });

    // Déconnexion
    socket.on('disconnect', () => {
      logger.info('User disconnected from chat', { 
        userId: socket.userId, 
        socketId: socket.id 
      });
    });
  }

  // Traiter un message utilisateur
  async handleMessage(socket, data) {
    try {
      const { message, conversationId } = data;
      const userId = socket.userId;
      const startTime = Date.now();

      // Obtenir ou créer la conversation
      const conversation = await chatService.getOrCreateConversation(userId, conversationId);

      // Sauvegarder le message utilisateur
      const userMessage = await chatService.saveMessage({
        conversationId: conversation.id,
        userId,
        type: 'USER',
        content: message,
        timestamp: new Date()
      });

      // Classification NLP
      const nlpResult = this.nlpService.classifyIntent(message);
      const entities = this.nlpService.extractEntities(message);

      // Log de l'intention
      await chatService.logIntent({
        userId,
        messageId: userMessage.id,
        userMessage: message,
        detectedIntent: nlpResult.intent,
        confidence: nlpResult.confidence,
        entities,
        processingTime: Date.now() - startTime,
        nlpProvider: 'basic'
      });

      // Générer la réponse selon l'intention
      const response = await this.generateResponse(userId, nlpResult.intent, entities, message);

      // Sauvegarder la réponse du bot
      const botMessage = await chatService.saveMessage({
        conversationId: conversation.id,
        type: 'BOT',
        content: response.content,
        intent: nlpResult.intent,
        confidence: nlpResult.confidence,
        entities,
        actions: response.actions,
        metadata: response.metadata,
        timestamp: new Date()
      });

      // Envoyer la réponse
      socket.emit('bot_response', {
        id: botMessage.id,
        type: 'bot',
        content: response.content,
        timestamp: botMessage.timestamp,
        intent: nlpResult.intent,
        actions: response.actions
      });

    } catch (error) {
      logger.logError(error, { context: 'handleMessage', userId: socket.userId });
      socket.emit('error', { 
        message: 'Erreur lors du traitement de votre message.' 
      });
    }
  }

  // Traiter une action rapide
  async handleQuickAction(socket, data) {
    try {
      const { action, params } = data;
      const userId = socket.userId;

      let result = {};
      let message = '';

      switch (action) {
        case 'view_leaves':
          result = await this.handleLeaveBalance(userId);
          message = this.formatLeaveBalanceMessage(result);
          break;

        case 'request_leave':
          if (params) {
            result = await this.handleLeaveRequest(userId, params);
            message = this.formatLeaveRequestMessage(result);
          } else {
            message = this.getLeaveRequestForm();
          }
          break;

        case 'view_payslip':
        case 'download_payslip':
          result = await this.handlePayslip(userId, params);
          message = this.formatPayslipMessage(result, action);
          break;

        case 'view_trainings':
          result = await this.handleTrainings(userId);
          message = this.formatTrainingsMessage(result);
          break;

        case 'enroll_training':
          if (params?.trainingId) {
            result = await this.handleTrainingEnrollment(userId, params.trainingId);
            message = this.formatEnrollmentMessage(result);
          }
          break;

        default:
          message = "Action non reconnue. Comment puis-je vous aider ?";
      }

      socket.emit('action_result', {
        action,
        result,
        message,
        timestamp: new Date()
      });

    } catch (error) {
      logger.logError(error, { context: 'handleQuickAction', userId: socket.userId, action: data.action });
      socket.emit('action_error', {
        action: data.action,
        error: error.message
      });
    }
  }

  // Traiter le feedback
  async handleFeedback(socket, data) {
    try {
      const { messageId, type } = data;
      const userId = socket.userId;

      await chatService.saveFeedback({
        messageId,
        userId,
        type: type === 'up' ? 'THUMBS_UP' : 'THUMBS_DOWN'
      });

      logger.logChat(userId, 'feedback_submitted', { messageId, type });

    } catch (error) {
      logger.logError(error, { context: 'handleFeedback', userId: socket.userId });
    }
  }

  // Générer une réponse selon l'intention
  async generateResponse(userId, intent, entities, originalMessage) {
    const responses = {
      greeting: {
        content: "Bonjour ! Je suis votre assistant RH. Comment puis-je vous aider aujourd'hui ?",
        actions: [
          { id: '1', label: 'Mes congés', action: 'view_leaves' },
          { id: '2', label: 'Ma paie', action: 'view_payslip' },
          { id: '3', label: 'Formations', action: 'view_trainings' },
          { id: '4', label: 'Aide', action: 'help' }
        ]
      },
      
      leave_balance: await this.generateLeaveResponse(userId),
      leave_request: await this.generateLeaveRequestResponse(userId),
      payroll: await this.generatePayrollResponse(userId),
      training: await this.generateTrainingResponse(userId),
      
      help: {
        content: `Je peux vous aider avec :
• **Congés** : Consulter vos soldes, faire des demandes
• **Paie** : Accéder à vos bulletins, historique
• **Formations** : Catalogue, inscriptions
• **Questions générales** : Politiques RH, procédures

Que souhaitez-vous faire ?`,
        actions: [
          { id: '1', label: 'Mes congés', action: 'view_leaves' },
          { id: '2', label: 'Ma paie', action: 'view_payslip' },
          { id: '3', label: 'Formations', action: 'view_trainings' }
        ]
      },
      
      general: {
        content: "Je comprends votre demande. Pouvez-vous préciser ce que vous cherchez ? Je peux vous aider avec vos congés, votre paie, les formations disponibles ou répondre à vos questions RH.",
        actions: [
          { id: '1', label: 'Congés', action: 'view_leaves' },
          { id: '2', label: 'Paie', action: 'view_payslip' },
          { id: '3', label: 'Formations', action: 'view_trainings' },
          { id: '4', label: 'Aide générale', action: 'help' }
        ]
      }
    };

    return responses[intent] || responses.general;
  }

  // Générer réponse pour les congés
  async generateLeaveResponse(userId) {
    try {
      const balance = await leaveService.getLeaveBalance(userId);
      const recentRequests = await leaveService.getUserLeaveRequests(userId, 3);

      const content = `📅 **Vos congés :**
• **Congés payés :** ${balance.paidLeave} jours
• **RTT :** ${balance.rtt} jours
• **Congés maladie :** ${balance.sickLeave} jours

${recentRequests.length > 0 ? `**Dernières demandes :**
${recentRequests.map(req => `• ${req.days}j ${req.type.toLowerCase()} - ${req.status}`).join('\n')}` : ''}

Que souhaitez-vous faire ?`;

      return {
        content,
        actions: [
          { id: '1', label: 'Faire une demande', action: 'request_leave' },
          { id: '2', label: 'Voir l\'historique', action: 'leave_history' }
        ],
        metadata: { balance, recentRequests }
      };
    } catch (error) {
      return {
        content: "Désolé, je n'arrive pas à récupérer vos informations de congés en ce moment.",
        actions: []
      };
    }
  }

  // Générer réponse pour les demandes de congés
  async generateLeaveRequestResponse(userId) {
    try {
      const balance = await leaveService.getLeaveBalance(userId);
      const pendingRequests = await leaveService.getUserLeaveRequests(userId, 5, 'PENDING');

      const content = `📝 **Demande de congés :**
• **Congés disponibles :** ${balance.paidLeave} jours
• **RTT disponibles :** ${balance.rtt} jours

${pendingRequests.length > 0 ? `**Demandes en attente :**
${pendingRequests.map(req => `• ${req.days}j ${req.type.toLowerCase()} - ${req.startDate} au ${req.endDate}`).join('\n')}\n\n` : ''}Que souhaitez-vous faire ?`;

      return {
        content,
        actions: [
          { id: '1', label: 'Nouvelle demande', action: 'create_leave_request' },
          { id: '2', label: 'Mes demandes', action: 'view_my_requests' },
          { id: '3', label: 'Voir le solde', action: 'view_leave_balance' }
        ],
        metadata: { balance, pendingRequests }
      };
    } catch (error) {
      logger.error('Erreur generateLeaveRequestResponse:', error);
      return {
        content: "Désolé, je n'arrive pas à récupérer vos informations de demandes de congés en ce moment.",
        actions: [
          { id: '1', label: 'Réessayer', action: 'leave_request' },
          { id: '2', label: 'Contacter RH', action: 'contact_hr' }
        ]
      };
    }
  }

  // Générer réponse pour la paie
  async generatePayrollResponse(userId) {
    try {
      const payslips = await payrollService.getUserPayslips(userId, 3);
      const latest = payslips[0];

      if (!latest) {
        return {
          content: "Aucun bulletin de paie disponible pour le moment.",
          actions: []
        };
      }

      const content = `💰 **Votre paie :**
• **Dernier bulletin :** ${latest.period}
• **Salaire net :** ${latest.netSalary.toLocaleString('fr-FR')}€
• **Salaire brut :** ${latest.grossSalary.toLocaleString('fr-FR')}€

Que voulez-vous consulter ?`;

      return {
        content,
        actions: [
          { id: '1', label: 'Télécharger bulletin', action: 'download_payslip', params: { payslipId: latest.id } },
          { id: '2', label: 'Historique paie', action: 'payslip_history' }
        ],
        metadata: { payslips }
      };
    } catch (error) {
      return {
        content: "Désolé, je n'arrive pas à récupérer vos informations de paie en ce moment.",
        actions: []
      };
    }
  }

  // Générer réponse pour les formations
  async generateTrainingResponse(userId) {
    try {
      const trainings = await trainingService.getTrainingCatalog(userId);
      const recommended = trainings.filter(t => t.recommended).slice(0, 3);

      const content = `🎓 **Formations disponibles :**

${recommended.length > 0 ? `**Recommandées pour vous :**
${recommended.map(t => `• **${t.title}** (${t.duration}) - ${t.availableSpots} places`).join('\n')}` : 'Aucune formation recommandée pour le moment.'}

Voulez-vous explorer le catalogue ?`;

      return {
        content,
        actions: [
          { id: '1', label: 'Voir le catalogue', action: 'browse_catalog' },
          { id: '2', label: 'Mes formations', action: 'my_trainings' }
        ],
        metadata: { trainings: recommended }
      };
    } catch (error) {
      return {
        content: "Désolé, je n'arrive pas à récupérer le catalogue de formations en ce moment.",
        actions: []
      };
    }
  }

  // Gestionnaires d'actions spécifiques
  async handleLeaveBalance(userId) {
    const balance = await leaveService.getLeaveBalance(userId);
    const requests = await leaveService.getUserLeaveRequests(userId, 5);
    return { balance, requests };
  }

  async handleLeaveRequest(userId, params) {
    const request = await leaveService.createLeaveRequest(userId, params);
    return { request };
  }

  async handlePayslip(userId, params) {
    if (params?.payslipId) {
      const downloadInfo = await payrollService.generateDownloadUrl(userId, params.payslipId);
      return downloadInfo;
    } else {
      const payslips = await payrollService.getUserPayslips(userId, 12);
      return { payslips };
    }
  }

  async handleTrainings(userId) {
    const catalog = await trainingService.getTrainingCatalog(userId);
    const userTrainings = await trainingService.getUserTrainings(userId);
    return { catalog, userTrainings };
  }

  async handleTrainingEnrollment(userId, trainingId) {
    const enrollment = await trainingService.enrollTraining(userId, trainingId);
    return { enrollment };
  }

  // Formatters de messages
  formatLeaveBalanceMessage(data) {
    const { balance, requests } = data;
    return `📅 **Vos congés actualisés :**
• Congés payés : ${balance.paidLeave} jours
• RTT : ${balance.rtt} jours
• Dernière mise à jour : ${new Date(balance.lastUpdate).toLocaleDateString('fr-FR')}`;
  }

  formatLeaveRequestMessage(data) {
    const { request } = data;
    return `✅ **Demande de congés créée !**
• Type : ${request.type}
• Période : ${new Date(request.startDate).toLocaleDateString('fr-FR')} - ${new Date(request.endDate).toLocaleDateString('fr-FR')}
• Durée : ${request.days} jour(s)
• Statut : ${request.status}

Votre demande a été transmise pour validation.`;
  }

  formatPayslipMessage(data, action) {
    if (action === 'download_payslip' && data.downloadUrl) {
      return `📄 **Bulletin de paie prêt !**
Votre bulletin de ${data.payslip.period} est disponible au téléchargement.
[Télécharger le bulletin](${data.downloadUrl})`;
    } else {
      return `💰 **Vos bulletins de paie :**
${data.payslips.map(p => `• ${p.period} - ${p.netSalary}€ net`).join('\n')}`;
    }
  }

  formatTrainingsMessage(data) {
    const { catalog } = data;
    const recommended = catalog.filter(t => t.recommended);
    return `🎓 **Formations recommandées :**
${recommended.map(t => `• **${t.title}** (${t.duration}) - ${t.availableSpots} places disponibles`).join('\n')}`;
  }

  formatEnrollmentMessage(data) {
    return `🎓 **Inscription confirmée !**
Votre inscription a été enregistrée avec succès.
Vous recevrez un email de confirmation avec les détails.`;
  }

  getLeaveRequestForm() {
    return `📝 **Demande de congés :**
Pour faire votre demande, utilisez les boutons ci-dessous ou précisez :
• Type de congé (congés payés, RTT, récupération)
• Dates souhaitées
• Motif (optionnel)`;
  }
}

module.exports = ChatHandler;