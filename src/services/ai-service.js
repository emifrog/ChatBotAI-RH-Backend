// Service d'intelligence artificielle utilisant OpenRouter

const { openrouter } = require('@openrouter/ai-sdk-provider');
const { generateText } = require('ai');
const axios = require('axios'); // Fallback pour les cas spéciaux

class AIService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    
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
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.buildContextMessages(context),
        { role: 'user', content: message }
      ];

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: 'deepseek/deepseek-r1-0528:free', // ou 'openai/gpt-3.5-turbo', ou 'anthropic/claude-instant'
          messages,
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://your-company.com',
            'X-Title': 'Chatbot RH'
          }
        }
      );

      const aiResponse = JSON.parse(response.data.choices[0].message.content);
      return this.processAIResponse(aiResponse);
    } catch (error) {
      console.error('Erreur AI Service:', error);
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
    
    // Détection basique d'intention
    if (lowerMessage.includes('congé') || lowerMessage.includes('vacance')) {
      return {
        intent: 'leave_balance',
        response: 'Je vais consulter vos informations de congés.',
        quickActions: this.getQuickActions('leave_balance')
      };
    }
    
    if (lowerMessage.includes('paie') || lowerMessage.includes('salaire') || lowerMessage.includes('bulletin')) {
      return {
        intent: 'payslip',
        response: 'Je vais récupérer vos bulletins de paie.',
        quickActions: this.getQuickActions('payslip')
      };
    }
    
    if (lowerMessage.includes('formation')) {
      return {
        intent: 'training',
        response: 'Voici les options concernant les formations.',
        quickActions: this.getQuickActions('training')
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