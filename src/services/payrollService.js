const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs').promises;

const prisma = new PrismaClient();

class PayrollService {
  // Récupérer les bulletins de paie d'un utilisateur
  async getUserPayslips(userId, limit = 12) {
    try {
      const cacheKey = `payslips:${userId}`;
      let payslips = await redis.get(cacheKey);

      if (!payslips) {
        payslips = await prisma.payslip.findMany({
          where: { userId },
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ],
          take: limit
        });

        // Si aucun bulletin, en créer des exemples
        if (payslips.length === 0) {
          payslips = await this.generateSamplePayslips(userId);
        }

        // Cache pour 1 heure
        await redis.set(cacheKey, payslips, 3600);
      }

      return payslips;
    } catch (error) {
      logger.logError(error, { context: 'getUserPayslips', userId });
      throw error;
    }
  }

  // Générer des bulletins d'exemple
  async generateSamplePayslips(userId) {
    try {
      const payslips = [];
      const currentDate = new Date();
      const baseSalary = 3200; // Salaire de base

      for (let i = 0; i < 6; i++) {
        const date = new Date(currentDate);
        date.setMonth(date.getMonth() - i);
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const period = `${year}-${month.toString().padStart(2, '0')}`;

        // Calculs avec variations réalistes
        const overtime = Math.random() > 0.7 ? Math.floor(Math.random() * 8) * 25 : 0;
        const bonus = i === 0 ? Math.floor(Math.random() * 500) : 0; // Bonus occasionnel
        
        const grossSalary = baseSalary + overtime + bonus;
        const taxes = Math.floor(grossSalary * 0.23); // 23% charges
        const netSalary = grossSalary - taxes;

        const payslipData = {
          userId,
          period,
          year,
          month,
          grossSalary,
          netSalary,
          taxes,
          overtime,
          bonus,
          benefits: {
            mutuelle: 45.50,
            ticketsRestaurant: 120,
            transport: 75.20,
            prevoyance: 23.80
          },
          deductions: {
            csg: Math.floor(grossSalary * 0.092),
            crds: Math.floor(grossSalary * 0.005),
            urssaf: Math.floor(grossSalary * 0.078),
            retraite: Math.floor(grossSalary * 0.075)
          },
          isGenerated: true,
          generatedAt: new Date(),
          metadata: {
            workingDays: 22,
            totalHours: 154,
            overtimeHours: overtime / 25,
            generatedBy: 'system'
          }
        };

        const payslip = await prisma.payslip.create({ data: payslipData });
        payslips.push(payslip);
      }

      logger.info('Sample payslips generated', { userId, count: payslips.length });
      return payslips;
    } catch (error) {
      logger.logError(error, { context: 'generateSamplePayslips', userId });
      throw error;
    }
  }

  // Récupérer un bulletin spécifique
  async getPayslip(userId, payslipId) {
    try {
      const payslip = await prisma.payslip.findFirst({
        where: {
          id: payslipId,
          userId
        }
      });

      if (!payslip) {
        throw new Error('Bulletin de paie non trouvé');
      }

      return payslip;
    } catch (error) {
      logger.logError(error, { context: 'getPayslip', userId, payslipId });
      throw error;
    }
  }

  // Générer l'URL de téléchargement d'un bulletin
  async generateDownloadUrl(userId, payslipId) {
    try {
      const payslip = await this.getPayslip(userId, payslipId);
      
      // Simuler la génération d'URL (en production, intégration avec service de documents)
      const downloadUrl = `/api/payroll/download/${payslipId}?token=${this.generateSecureToken(payslipId)}`;
      
      logger.info('Download URL generated', { userId, payslipId });
      return { downloadUrl, payslip };
    } catch (error) {
      logger.logError(error, { context: 'generateDownloadUrl', userId, payslipId });
      throw error;
    }
  }

  // Générer un token sécurisé pour le téléchargement
  generateSecureToken(payslipId) {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const data = `${payslipId}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  // Statistiques de paie
  async getPayrollStats(userId) {
    try {
      const currentYear = new Date().getFullYear();
      
      const stats = await prisma.payslip.aggregate({
        where: {
          userId,
          year: currentYear
        },
        _avg: {
          grossSalary: true,
          netSalary: true
        },
        _sum: {
          grossSalary: true,
          netSalary: true,
          taxes: true,
          overtime: true,
          bonus: true
        },
        _count: true
      });

      const monthlyEvolution = await prisma.payslip.findMany({
        where: {
          userId,
          year: currentYear
        },
        select: {
          month: true,
          netSalary: true,
          grossSalary: true
        },
        orderBy: { month: 'asc' }
      });

      return {
        currentYear: {
          averageGross: stats._avg.grossSalary || 0,
          averageNet: stats._avg.netSalary || 0,
          totalGross: stats._sum.grossSalary || 0,
          totalNet: stats._sum.netSalary || 0,
          totalTaxes: stats._sum.taxes || 0,
          totalOvertime: stats._sum.overtime || 0,
          totalBonus: stats._sum.bonus || 0,
          bulletinCount: stats._count
        },
        monthlyEvolution
      };
    } catch (error) {
      logger.logError(error, { context: 'getPayrollStats', userId });
      throw error;
    }
  }
}

module.exports = new PayrollService();