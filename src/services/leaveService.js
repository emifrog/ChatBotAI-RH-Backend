const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');
const logger = require('../config/logger');

const prisma = new PrismaClient();

class LeaveService {
  // Récupérer le solde de congés
  async getLeaveBalance(userId) {
    try {
      const cacheKey = `leave_balance:${userId}`;
      let balance = await redis.get(cacheKey);

      if (!balance) {
        const currentYear = new Date().getFullYear();
        
        balance = await prisma.leaveBalance.findFirst({
          where: {
            userId,
            year: currentYear
          }
        });

        if (!balance) {
          // Créer un solde initial si n'existe pas
          balance = await prisma.leaveBalance.create({
            data: {
              userId,
              paidLeave: 25,
              rtt: 12,
              sickLeave: 0,
              year: currentYear
            }
          });
        }

        // Mettre en cache pour 10 minutes
        await redis.set(cacheKey, balance, 600);
      }

      return balance;
    } catch (error) {
      logger.logError(error, { context: 'getLeaveBalance', userId });
      throw error;
    }
  }

  // Créer une demande de congés
  async createLeaveRequest(userId, requestData) {
    try {
      // Calculer le nombre de jours
      const startDate = new Date(requestData.startDate);
      const endDate = new Date(requestData.endDate);
      const days = this.calculateBusinessDays(startDate, endDate);

      // Vérifier le solde
      const balance = await this.getLeaveBalance(userId);
      const fieldMap = {
        'PAID': 'paidLeave',
        'RTT': 'rtt',
        'SICK': 'sickLeave'
      };

      const balanceField = fieldMap[requestData.type];
      if (balanceField && balance[balanceField] < days) {
        throw new Error(`Solde insuffisant. Disponible: ${balance[balanceField]} jours, Demandé: ${days} jours`);
      }

      // Créer la demande
      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          userId,
          type: requestData.type,
          startDate,
          endDate,
          days,
          reason: requestData.reason || null,
          status: 'PENDING',
          metadata: {
            autoApproval: days <= 1, // Auto-approbation pour 1 jour
            requestedAt: new Date()
          }
        }
      });

      // Invalider le cache
      await redis.del(`leave_balance:${userId}`);
      await redis.del(`leave_requests:${userId}`);

      logger.info('Leave request created', {
        userId,
        requestId: leaveRequest.id,
        type: requestData.type,
        days
      });

      // Auto-approbation pour les demandes d'1 jour
      if (days <= 1 && requestData.type !== 'SICK') {
        await this.approveLeaveRequest(leaveRequest.id, 'system');
      }

      return leaveRequest;
    } catch (error) {
      logger.logError(error, { context: 'createLeaveRequest', userId });
      throw error;
    }
  }

  // Approuver une demande de congés
  async approveLeaveRequest(requestId, approvedBy) {
    try {
      const request = await prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date()
        }
      });

      // Décrémenter le solde
      const fieldMap = {
        'PAID': 'paidLeave',
        'RTT': 'rtt',
        'SICK': 'sickLeave'
      };

      const balanceField = fieldMap[request.type];
      if (balanceField) {
        const currentYear = new Date().getFullYear();
        await prisma.leaveBalance.updateMany({
          where: {
            userId: request.userId,
            year: currentYear
          },
          data: {
            [balanceField]: {
              decrement: request.days
            },
            lastUpdate: new Date()
          }
        });
      }

      // Créer une notification
      await prisma.notification.create({
        data: {
          userId: request.userId,
          type: 'LEAVE_APPROVED',
          title: 'Congés approuvés',
          message: `Votre demande de ${request.days} jour(s) de ${request.type.toLowerCase()} a été approuvée.`,
          data: { requestId }
        }
      });

      // Invalider les caches
      await redis.del(`leave_balance:${request.userId}`);
      await redis.del(`leave_requests:${request.userId}`);

      logger.info('Leave request approved', {
        requestId,
        userId: request.userId,
        approvedBy,
        days: request.days
      });

      return request;
    } catch (error) {
      logger.logError(error, { context: 'approveLeaveRequest', requestId });
      throw error;
    }
  }

  // Récupérer les demandes de congés d'un utilisateur
  async getUserLeaveRequests(userId, limit = 10) {
    try {
      const cacheKey = `leave_requests:${userId}`;
      let requests = await redis.get(cacheKey);

      if (!requests) {
        requests = await prisma.leaveRequest.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit
        });

        // Cache pour 5 minutes
        await redis.set(cacheKey, requests, 300);
      }

      return requests;
    } catch (error) {
      logger.logError(error, { context: 'getUserLeaveRequests', userId });
      throw error;
    }
  }

  // Calculer les jours ouvrables
  calculateBusinessDays(startDate, endDate) {
    let count = 0;
    const curDate = new Date(startDate);
    
    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclure samedi et dimanche
        count++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }
    
    return count;
  }

  // Obtenir les statistiques de congés
  async getLeaveStats(userId) {
    try {
      const currentYear = new Date().getFullYear();
      
      const [balance, requests, stats] = await Promise.all([
        this.getLeaveBalance(userId),
        this.getUserLeaveRequests(userId, 50),
        prisma.leaveRequest.groupBy({
          by: ['status'],
          _count: { status: true },
          _sum: { days: true },
          where: {
            userId,
            createdAt: {
              gte: new Date(currentYear, 0, 1),
              lt: new Date(currentYear + 1, 0, 1)
            }
          }
        })
      ]);

      const usedDays = stats.reduce((acc, stat) => {
        if (stat.status === 'APPROVED') {
          return acc + (stat._sum.days || 0);
        }
        return acc;
      }, 0);

      return {
        balance,
        requests: requests.slice(0, 5), // Dernières 5 demandes
        stats: {
          totalRequests: requests.length,
          usedDays,
          pendingRequests: requests.filter(r => r.status === 'PENDING').length,
          approvedRequests: requests.filter(r => r.status === 'APPROVED').length,
          rejectedRequests: requests.filter(r => r.status === 'REJECTED').length
        }
      };
    } catch (error) {
      logger.logError(error, { context: 'getLeaveStats', userId });
      throw error;
    }
  }
}

module.exports = new LeaveService();