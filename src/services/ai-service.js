// Service d'intelligence artificielle utilisant OpenRouter

const { openrouter } = require('@openrouter/ai-sdk-provider');
const { generateText } = require('ai');
const axios = require('axios'); // Fallback pour les cas spéciaux

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = process.env.OPENROUTER_BASE_URL;
    
    // Contexte système pour le chatbot RH
    this.systemPrompt = `Tu es un assistant RH intelligent pour l'entreprise. Tu as accès aux informations suivantes :
    
    - Gestion des congés (soldes, demandes, historique)
    - Bulletins de paie et informations salariales
    - Catalogue de formations et inscriptions
    - Informations employés et organigramme
    - Procédures et politiques RH
    
    Règles importantes :
    1. Sois professionnel mais amical
    2. Donne des réponses concises et précises
    3. Si tu n'as pas l'information, propose de contacter les RH
    4. Respecte la confidentialité des données
    5. Utilise le tutoiement sauf si l'employé préfère le vouvoiement
    
    Pour les actions spécifiques, retourne un JSON avec le format :
    {
      "intent": "leave_balance|leave_request|payslip|training|general",
      "entities": {
        "type": "string",
        "startDate": "date",
        "endDate": "date",
        "other": "any"
      },
      "response": "Ta réponse en langage naturel"
    }`;
  }

  // Analyser le message et générer une réponse
  async processMessage(message, context = {}) {
    try {
      // Vérifier la clé API
      if (!this.apiKey) {
        console.warn('OpenRouter API key manquante, utilisation du fallback');
        return this.getFallbackResponse(message);
      }

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.buildContextMessages(context),
        { role: 'user', content: message }
      ];

      // Timeout de 10 secondes pour éviter les blocages
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );

      const apiPromise = axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'deepseek/deepseek-r1-0528:free', // Modèle gratuit
          messages,
          temperature: 0.7,
          max_tokens: 300,
          // Suppression du format JSON forcé pour éviter les blocages
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://chatbot-rh.com',
            'X-Title': 'Chatbot RH'
          },
          timeout: 10000 // Timeout axios de 10 secondes
        }
      );

      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      let aiResponse;
      const content = response.data.choices[0].message.content;
      
      // Essayer de parser en JSON, sinon traiter comme texte
      try {
        aiResponse = JSON.parse(content);
      } catch (jsonError) {
        // Si ce n'est pas du JSON, créer une réponse structurée
        aiResponse = {
          intent: 'general',
          entities: {},
          response: content.trim()
        };
      }
      
      return this.processAIResponse(aiResponse);
    } catch (error) {
      console.error('Erreur AI Service:', error.message);
      return this.getFallbackResponse(message);
    }
  }

  // Construire les messages de contexte
  buildContextMessages(context) {
    const messages = [];
    
    if (context.userInfo) {
      messages.push({
        role: 'system',
        content: `Informations utilisateur : ${JSON.stringify(context.userInfo)}`
      });
    }
    
    if (context.previousMessages) {
      messages.push(...context.previousMessages.slice(-5)); // 5 derniers messages
    }
    
    return messages;
  }

  // Traiter la réponse de l'IA
  processAIResponse(aiResponse) {
    // Valider et enrichir la réponse
    const validIntents = ['leave_balance', 'leave_request', 'payslip', 'training', 'general'];
    
    if (!validIntents.includes(aiResponse.intent)) {
      aiResponse.intent = 'general';
    }
    
    // Ajouter des quick actions selon l'intent
    aiResponse.quickActions = this.getQuickActions(aiResponse.intent);
    
    return aiResponse;
  }

  // Actions rapides suggérées
  getQuickActions(intent) {
    const actions = {
      leave_balance: [
        { label: '📊 Voir le détail', action: 'view_leave_details' },
        { label: '➕ Faire une demande', action: 'create_leave_request' },
        { label: '📅 Historique', action: 'view_leave_history' }
      ],
      leave_request: [
        { label: '✅ Confirmer', action: 'confirm_request' },
        { label: '📅 Modifier les dates', action: 'modify_dates' },
        { label: '❌ Annuler', action: 'cancel_request' }
      ],
      payslip: [
        { label: '📥 Télécharger', action: 'download_payslip' },
        { label: '📊 Voir le détail', action: 'view_details' },
        { label: '📆 Historique', action: 'view_history' }
      ],
      training: [
        { label: '📚 Catalogue', action: 'view_catalog' },
        { label: '✍️ S\'inscrire', action: 'enroll' },
        { label: '🎓 Mes formations', action: 'my_trainings' }
      ],
      general: [
        { label: '🏖️ Congés', action: 'leaves' },
        { label: '💰 Paie', action: 'payroll' },
        { label: '📚 Formations', action: 'training' },
        { label: '👤 Mon profil', action: 'profile' }
      ]
    };
    
    return actions[intent] || actions.general;
  }

  // Réponse de secours si l'IA échoue
  getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    console.log('Utilisation du fallback pour:', message);
    
    // Détection basique d'intention avec réponses plus détaillées
    if (lowerMessage.includes('congé') || lowerMessage.includes('vacance') || lowerMessage.includes('rtt')) {
      return {
        intent: 'leave_balance',
        entities: { type: 'congés' },
        response: '🏖️ Je peux vous aider avec vos congés ! Voulez-vous consulter votre solde, faire une demande ou voir l\'historique ?',
        quickActions: this.getQuickActions('leave_balance'),
        suggestions: ['Voir mon solde de congés', 'Faire une demande de congés', 'Historique de mes congés']
      };
    }
    
    if (lowerMessage.includes('paie') || lowerMessage.includes('salaire') || lowerMessage.includes('bulletin') || lowerMessage.includes('fiche')) {
      return {
        intent: 'payslip',
        entities: { type: 'bulletins' },
        response: '💰 Je peux vous aider avec vos bulletins de paie ! Voulez-vous télécharger le dernier bulletin ou consulter l\'historique ?',
        quickActions: this.getQuickActions('payslip'),
        suggestions: ['Télécharger mon dernier bulletin', 'Voir l\'historique des paies', 'Expliquer ma fiche de paie']
      };
    }
    
    if (lowerMessage.includes('formation') || lowerMessage.includes('cours') || lowerMessage.includes('apprentissage')) {
      return {
        intent: 'training',
        entities: { type: 'formations' },
        response: '📚 Je peux vous aider avec les formations ! Voulez-vous voir le catalogue, vous inscrire ou consulter vos formations en cours ?',
        quickActions: this.getQuickActions('training'),
        suggestions: ['Voir le catalogue de formations', 'Mes formations en cours', 'Formations recommandées']
      };
    }
    
    // Salutations
    if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('hello')) {
      return {
        intent: 'general',
        entities: {},
        response: '👋 Bonjour ! Je suis votre assistant RH. Je peux vous aider avec vos congés, bulletins de paie, formations et bien plus encore. Que puis-je faire pour vous ?',
        quickActions: this.getQuickActions('general'),
        suggestions: ['Voir mes congés', 'Télécharger ma fiche de paie', 'Catalogue de formations', 'Mon profil']
      };
    }
    
    // Questions d'aide
    if (lowerMessage.includes('aide') || lowerMessage.includes('help') || lowerMessage.includes('que peux') || lowerMessage.includes('comment')) {
      return {
        intent: 'general',
        entities: {},
        response: '🤖 Je suis votre assistant RH intelligent ! Je peux vous aider avec :\n\n• 🏖️ Gestion des congés (soldes, demandes)\n• 💰 Bulletins de paie et informations salariales\n• 📚 Formations et développement\n• 👤 Informations de profil\n• 📞 Contacts et procédures\n\nQue souhaitez-vous faire ?',
        quickActions: this.getQuickActions('general'),
        suggestions: ['Mes congés restants', 'Mon dernier bulletin', 'Formations disponibles', 'Contacter les RH']
      };
    }
    
    return {
      intent: 'general',
      response: 'Comment puis-je vous aider aujourd\'hui ?',
      quickActions: this.getQuickActions('general')
    };
  }

  // Générer des suggestions de questions
  async generateSuggestions(context) {
    const baseSuggestions = [
      "Quel est mon solde de congés ?",
      "Je voudrais poser des congés",
      "Où est mon dernier bulletin de paie ?",
      "Quelles formations sont disponibles ?",
      "Comment mettre à jour mes coordonnées ?"
    ];
    
    // Personnaliser selon le contexte
    if (context.lastIntent === 'leave_balance') {
      return [
        "Je veux poser 5 jours en août",
        "Combien de RTT me reste-t-il ?",
        "Voir mon historique de congés",
        "Annuler ma dernière demande"
      ];
    }
    
    return baseSuggestions.slice(0, 4);
  }
}

module.exports = new AIService();