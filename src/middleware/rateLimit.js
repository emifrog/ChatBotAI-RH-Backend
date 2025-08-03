const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // 50 en dev, 5 en prod
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes.'
  },
  skipSuccessfulRequests: true,
});

// Rate limiting pour les messages de chat
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages par minute
  message: {
    success: false,
    message: 'Trop de messages envoyés, ralentissez un peu.'
  },
});

// Rate limiting personnalisé avec Redis
const createCustomLimiter = (options) => {
  return async (req, res, next) => {
    const key = `rate_limit:${options.keyGenerator(req)}`;
    const current = await redis.get(key) || 0;
    
    if (current >= options.max) {
      return res.status(429).json({
        success: false,
        message: options.message || 'Limite de taux dépassée'
      });
    }
    
    await redis.set(key, current + 1, options.windowMs / 1000);
    next();
  };
};

module.exports = {
  globalLimiter,
  authLimiter,
  chatLimiter,
  createCustomLimiter
};