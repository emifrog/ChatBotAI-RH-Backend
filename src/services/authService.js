const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');
const logger = require('../config/logger');

const prisma = new PrismaClient();

class AuthService {
  // Génération des tokens JWT
  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

    return { accessToken, refreshToken };
  }

  // Vérification du token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Vérifier si le token est en blacklist
      const blacklisted = await redis.exists(`blacklist:${token}`);
      if (blacklisted) {
        throw new Error('Token blacklisted');
      }

      return decoded;
    } catch (error) {
      logger.logError(error, { context: 'verifyToken' });
      throw new Error('Token invalide');
    }
  }

  // Inscription utilisateur
  async register(userData) {
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        throw new Error('Email déjà utilisé');
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
          department: true,
          role: true,
          createdAt: true,
        }
      });

      // Créer le solde de congés initial
      await prisma.leaveBalance.create({
        data: {
          userId: user.id,
          paidLeave: 25, // 25 jours par défaut
          rtt: 12,       // 12 RTT par défaut
          sickLeave: 0,
          year: new Date().getFullYear(),
        }
      });

      logger.info('User registered', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      logger.logError(error, { context: 'register', email: userData.email });
      throw error;
    }
  }

  // Connexion utilisateur
  async login(email, password, userAgent, ipAddress) {
    try {
      // Trouver l'utilisateur
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          sessions: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!user || !user.isActive) {
        throw new Error('Utilisateur non trouvé ou inactif');
      }

      // Vérifier le mot de passe
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Mot de passe incorrect');
      }

      // Générer les tokens
      const { accessToken, refreshToken } = this.generateTokens(user);

      // Créer la session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 jours

      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          expiresAt,
          userAgent,
          ipAddress,
        }
      });

      // Mettre à jour la dernière connexion
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      // Cache des données utilisateur
      await redis.set(`user:${user.id}`, {
        id: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        role: user.role,
      }, 3600);

      logger.info('User logged in', { 
        userId: user.id, 
        email: user.email,
        userAgent,
        ipAddress 
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          department: user.department,
          role: user.role,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.logError(error, { context: 'login', email });
      throw error;
    }
  }

  // Déconnexion
  async logout(token) {
    try {
      // Désactiver la session
      await prisma.userSession.updateMany({
        where: { token },
        data: { isActive: false }
      });

      // Ajouter le token à la blacklist
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.set(`blacklist:${token}`, true, ttl);
        }
      }

      logger.info('User logged out', { token: token.substring(0, 20) + '...' });
    } catch (error) {
      logger.logError(error, { context: 'logout' });
      throw error;
    }
  }

  // Rafraîchir le token
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      
      // Vérifier que la session existe et est active
      const session = await prisma.userSession.findFirst({
        where: {
          refreshToken,
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Session invalide');
      }

      // Générer de nouveaux tokens
      const tokens = this.generateTokens(session.user);

      // Mettre à jour la session
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }
      });

      return tokens;
    } catch (error) {
      logger.logError(error, { context: 'refreshToken' });
      throw error;
    }
  }

  // Récupérer l'utilisateur par token
  async getUserByToken(token) {
    try {
      const decoded = await this.verifyToken(token);
      
      // Essayer le cache d'abord
      let user = await redis.get(`user:${decoded.userId}`);
      
      if (!user) {
        // Récupérer depuis la base de données
        user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            name: true,
            department: true,
            role: true,
            isActive: true,
          }
        });

        if (user && user.isActive) {
          // Mettre en cache
          await redis.set(`user:${user.id}`, user, 3600);
        }
      }

      if (!user || !user.isActive) {
        throw new Error('Utilisateur non trouvé ou inactif');
      }

      return user;
    } catch (error) {
      logger.logError(error, { context: 'getUserByToken' });
      throw error;
    }
  }
}

module.exports = new AuthService();