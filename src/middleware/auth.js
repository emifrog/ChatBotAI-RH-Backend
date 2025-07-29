const authService = require('../services/authService');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    const user = await authService.getUserByToken(token);
    req.user = user;
    next();
  } catch (error) {
    logger.logError(error, { context: 'authMiddleware' });
    res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
};

// Middleware optionnel (ne bloque pas si pas de token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const user = await authService.getUserByToken(token);
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Ignore les erreurs d'auth pour ce middleware
    next();
  }
};

module.exports = { authMiddleware, optionalAuth };