const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

class AuthController {
  // Inscription
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const user = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès',
        data: { user }
      });
    } catch (error) {
      logger.logError(error, { context: 'register', body: req.body });
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Connexion
  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip;

      const result = await authService.login(email, password, userAgent, ipAddress);
      
      res.json({
        success: true,
        message: 'Connexion réussie',
        data: result
      });
    } catch (error) {
      logger.logError(error, { context: 'login', email: req.body.email });
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  // Déconnexion
  async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        await authService.logout(token);
      }

      res.json({
        success: true,
        message: 'Déconnexion réussie'
      });
    } catch (error) {
      logger.logError(error, { context: 'logout' });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la déconnexion'
      });
    }
  }

  // Rafraîchir le token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token manquant'
        });
      }

      const tokens = await authService.refreshToken(refreshToken);
      
      res.json({
        success: true,
        message: 'Token rafraîchi',
        data: tokens
      });
    } catch (error) {
      logger.logError(error, { context: 'refreshToken' });
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  // Profil utilisateur
  async getProfile(req, res) {
    try {
      const user = req.user; // Injecté par le middleware auth
      
      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      logger.logError(error, { context: 'getProfile', userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil'
      });
    }
  }
}

module.exports = new AuthController();