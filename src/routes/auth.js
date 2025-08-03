const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

// Routes publiques
if (process.env.NODE_ENV === 'development') {
  // En développement : pas de rate limiting
  router.post('/register', validateRegister, authController.register);
  router.post('/login', validateLogin, authController.login);
} else {
  // En production : avec rate limiting
  router.post('/register', authLimiter, validateRegister, authController.register);
  router.post('/login', authLimiter, validateLogin, authController.login);
}
router.post('/refresh', authController.refreshToken);

// Routes protégées
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;