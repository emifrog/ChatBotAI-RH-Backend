const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import des configurations
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimit');

// Import des routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const leaveRoutes = require('./routes/leaves');

const createApp = () => {
  const app = express();

  // Configuration de sécurité
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24h
  }));

  // Parsing du body
  app.use(express.json({ 
    limit: '10mb',
    type: ['application/json', 'application/json; charset=utf-8']
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging des requêtes
  const morganFormat = process.env.NODE_ENV === 'production' 
    ? 'combined' 
    : ':method :url :status :res[content-length] - :response-time ms';
  
  app.use(morgan(morganFormat, {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Rate limiting
  if (process.env.NODE_ENV !== 'development') {
    app.use('/api/', globalLimiter);
  }

  // Trust proxy (important pour Nginx, Heroku, etc.)
  app.set('trust proxy', 1);

  // Routes de santé
  app.get('/health', async (req, res) => {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };

    try {
      // Vérifier la base de données
      const db = require('./config/database');
      const dbHealth = await db.healthCheck();
      health.database = dbHealth;

      // Vérifier Redis
      const redis = require('./config/redis');
      health.redis = {
        status: redis.isConnected ? 'healthy' : 'unhealthy',
        timestamp: new Date()
      };

      res.json(health);
    } catch (error) {
      logger.logError(error, { context: 'health_check' });
      res.status(503).json({
        ...health,
        status: 'ERROR',
        error: error.message
      });
    }
  });

  // Route de métrics (pour monitoring)
  app.get('/metrics', (req, res) => {
    const metrics = {
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      timestamp: new Date().toISOString()
    };
    res.json(metrics);
  });

  // Routes API
  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/leaves', leaveRoutes);

  // Servir les fichiers statiques (uploads, documentation, etc.)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  app.use('/docs', express.static(path.join(__dirname, '../docs')));

  // Route racine
  app.get('/', (req, res) => {
    res.json({
      name: 'Chatbot RH API',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      documentation: '/docs',
      health: '/health',
      timestamp: new Date().toISOString()
    });
  });

  // Gestionnaire des routes non trouvées
  app.use(notFoundHandler);

  // Gestionnaire d'erreurs global
  app.use(errorHandler);

  return app;
};

module.exports = createApp;