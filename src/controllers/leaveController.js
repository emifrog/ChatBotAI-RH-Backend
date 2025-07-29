const leaveService = require('../services/leaveService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

class LeaveController {
  // Récupérer le solde de congés
  async getBalance(req, res) {
    try {
      const userId = req.user.id;
      const balance = await leaveService.getLeaveBalance(userId);
      
      res.json({
        success: true,
        data: { balance }
      });
    } catch (error) {
      logger.logError(error, { context: 'getBalance', userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du solde'
      });
    }
  }

  // Créer une demande de congés
  async createRequest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const request = await leaveService.createLeaveRequest(userId, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Demande de congés créée',
        data: { request }
      });
    } catch (error) {
      logger.logError(error, { context: 'createRequest', userId: req.user?.id });
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Récupérer les demandes de congés
  async getRequests(req, res) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;
      
      const requests = await leaveService.getUserLeaveRequests(userId, limit);
      
      res.json({
        success: true,
        data: { requests }
      });
    } catch (error) {
      logger.logError(error, { context: 'getRequests', userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des demandes'
      });
    }
  }

  // Statistiques des congés
  async getStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await leaveService.getLeaveStats(userId);
      
      res.json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      logger.logError(error, { context: 'getStats', userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = new LeaveController();