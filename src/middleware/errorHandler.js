const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.logError(err, {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id
  });

  // Erreurs Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Données déjà existantes (conflit de contrainte unique)'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Ressource non trouvée'
    });
  }

  // Erreurs de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expiré'
    });
  }

  // Erreur 404 pour les routes non trouvées
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      message: 'Endpoint non trouvé'
    });
  }

  // Erreur générique
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erreur interne du serveur' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Gestionnaire pour les routes non trouvées
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} non trouvée`
  });
};

module.exports = { errorHandler, notFoundHandler };