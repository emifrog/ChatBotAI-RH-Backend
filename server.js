require('dotenv').config();
const { createServer } = require('http');
const createApp = require('./src/app');
const database = require('./src/config/database');
const redis = require('./src/config/redis');
const initializeSocket = require('./src/socket');
const logger = require('./src/config/logger');

// Gestion des erreurs non gérées
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Gestion des signaux de fermeture
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function startServer() {
  try {
    // Initialiser les connexions
    logger.info('🚀 Démarrage du serveur Chatbot RH...');
    
    // Connexion à la base de données
    await database.connect();
    
    // Connexion à Redis
    redis.connect();
    
    // Créer l'application Express
    const app = createApp();
    const server = createServer(app);
    
    // Initialiser Socket.IO
    const io = initializeSocket(server, redis);
    
    // Démarrer le serveur
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`✅ Serveur démarré sur le port ${PORT}`);
      logger.info(`📖 Documentation: http://localhost:${PORT}/docs`);
      logger.info(`❤️ Health check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environnement: ${process.env.NODE_ENV}`);
    });

    // Nettoyage périodique (toutes les heures)
    setInterval(async () => {
      try {
        const sessionsDeleted = await database.cleanExpiredSessions();
        const cacheDeleted = await database.cleanExpiredCache();
        
        if (sessionsDeleted > 0 || cacheDeleted > 0) {
          logger.info('Cleanup completed', { 
            sessionsDeleted, 
            cacheDeleted 
          });
        }
      } catch (error) {
        logger.logError(error, { context: 'periodic_cleanup' });
      }
    }, 60 * 60 * 1000); // 1 heure

    return server;
  } catch (error) {
    logger.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info(`📴 Signal ${signal} reçu, arrêt gracieux...`);
  
  try {
    // Fermer les connexions
    await database.disconnect();
    redis.disconnect();
    
    logger.info('✅ Arrêt gracieux terminé');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
}

// Démarrer le serveur si ce fichier est exécuté directement
if (require.main === module) {
  startServer();
}

module.exports = { startServer, gracefulShutdown };