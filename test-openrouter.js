// Script de test pour OpenRouter avec DeepSeek
require('dotenv').config();
const axios = require('axios');

async function testOpenRouter() {
  console.log('🧪 Test du modèle DeepSeek via OpenRouter...\n');
  
  // Vérifier les variables d'environnement
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY manquante dans .env');
    return;
  }
  
  if (!process.env.OPENROUTER_BASE_URL) {
    console.error('❌ OPENROUTER_BASE_URL manquante dans .env');
    return;
  }
  
  console.log('✅ Variables d\'environnement trouvées');
  console.log('📡 URL:', process.env.OPENROUTER_BASE_URL);
  console.log('🔑 API Key:', process.env.OPENROUTER_API_KEY.substring(0, 10) + '...\n');
  
  try {
    const response = await axios.post(
      `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: 'deepseek/deepseek-r1-0528:free',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant RH. Réponds de manière concise et professionnelle.'
          },
          {
            role: 'user',
            content: 'Bonjour, peux-tu me dire combien de jours de congés il me reste ?'
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://chatbot-rh.com',
          'X-Title': 'Chatbot RH Test'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Réponse reçue avec succès !');
    console.log('📊 Modèle utilisé:', response.data.model);
    console.log('💬 Réponse du bot:');
    console.log('---');
    console.log(response.data.choices[0].message.content);
    console.log('---\n');
    
    // Informations sur l'utilisation
    if (response.data.usage) {
      console.log('📈 Utilisation:');
      console.log('  - Tokens prompt:', response.data.usage.prompt_tokens);
      console.log('  - Tokens réponse:', response.data.usage.completion_tokens);
      console.log('  - Total tokens:', response.data.usage.total_tokens);
    }
    
    console.log('🎉 Test réussi ! Le modèle DeepSeek fonctionne correctement.');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('Pas de réponse du serveur');
      console.error('Request:', error.request);
    } else {
      console.error('Erreur:', error.message);
    }
    
    console.log('\n💡 Suggestions:');
    console.log('1. Vérifiez votre clé API OpenRouter');
    console.log('2. Vérifiez que vous avez des crédits/quota disponibles');
    console.log('3. Vérifiez votre connexion internet');
    console.log('4. Le modèle gratuit peut avoir des limitations de taux');
  }
}

// Exécuter le test
testOpenRouter();
