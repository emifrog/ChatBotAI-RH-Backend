const winston = require('winston');
const path = require('path');

// Formats personnalisés
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Configuration des transports
const transports = [
  // Console (développement)
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: consoleFormat,
    handleExceptions: true,
  }),

  // Fichier pour toutes les logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'app.log'),
    level: 'info',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Fichier pour les erreurs uniquement
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'chatbot-rh' },
  transports,
  exitOnError: false,
});

// Méthodes utilitaires
logger.logRequest = (req, res, responseTime) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

logger.logChat = (userId, action, data = {}) => {
  logger.info('Chat Activity', {
    userId,
    action,
    ...data,
  });
};

module.exports = logger;