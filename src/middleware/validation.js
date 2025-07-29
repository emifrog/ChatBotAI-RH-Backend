const { body, param, query } = require('express-validator');

// Validation pour l'inscription
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email valide requis'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mot de passe minimum 6 caractères'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nom requis (minimum 2 caractères)'),
  body('department')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Département invalide'),
  body('role')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Rôle invalide')
];

// Validation pour la connexion
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email valide requis'),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
];

// Validation pour les demandes de congés
const validateLeaveRequest = [
  body('type')
    .isIn(['PAID', 'RTT', 'SICK', 'MATERNITY', 'PATERNITY', 'SPECIAL', 'UNPAID'])
    .withMessage('Type de congé invalide'),
  body('startDate')
    .isISO8601()
    .toDate()
    .withMessage('Date de début invalide'),
  body('endDate')
    .isISO8601()
    .toDate()
    .withMessage('Date de fin invalide')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('La date de fin doit être après la date de début');
      }
      return true;
    }),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Raison trop longue (maximum 500 caractères)')
];

// Validation pour le feedback
const validateFeedback = [
  body('messageId')
    .isString()
    .notEmpty()
    .withMessage('ID du message requis'),
  body('type')
    .isIn(['THUMBS_UP', 'THUMBS_DOWN', 'RATING', 'COMMENT', 'BUG_REPORT'])
    .withMessage('Type de feedback invalide'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Note entre 1 et 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Commentaire trop long (maximum 1000 caractères)')
];

// Validation des paramètres d'URL
const validateObjectId = (paramName) => [
  param(paramName)
    .isString()
    .notEmpty()
    .withMessage(`${paramName} invalide`)
];

module.exports = {
  validateRegister,
  validateLogin,
  validateLeaveRequest,
  validateFeedback,
  validateObjectId
};