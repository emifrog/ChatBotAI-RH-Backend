const { PrismaClient } = require('@prisma/client');
const redis = require('../config/redis');
const logger = require('../config/logger');

const prisma = new PrismaClient();

class TrainingService {
  // Récupérer le catalogue des formations
  async getTrainingCatalog(userId, filters = {}) {
    try {
      const cacheKey = `training_catalog:${JSON.stringify(filters)}`;
      let trainings = await redis.get(cacheKey);

      if (!trainings) {
        const where = {
          isActive: true,
          ...(filters.category && { category: filters.category }),
          ...(filters.difficulty && { difficulty: filters.difficulty }),
          ...(filters.isOnline !== undefined && { isOnline: filters.isOnline })
        };

        trainings = await prisma.training.findMany({
          where,
          orderBy: [
            { startDate: 'asc' },
            { title: 'asc' }
          ]
        });

        // Si aucune formation, en créer des exemples
        if (trainings.length === 0) {
          trainings = await this.generateSampleTrainings();
        }

        // Ajouter les recommandations personnalisées
        trainings = await this.addRecommendations(trainings, userId);

        // Cache pour 30 minutes
        await redis.set(cacheKey, trainings, 1800);
      }

      return trainings;
    } catch (error) {
      logger.logError(error, { context: 'getTrainingCatalog', userId });
      throw error;
    }
  }

  // Générer des formations d'exemple
  async generateSampleTrainings() {
    try {
      const sampleTrainings = [
        {
          title: 'React Advanced - Hooks et Performance',
          description: 'Maîtrisez les hooks avancés de React et optimisez les performances de vos applications.',
          category: 'Développement',
          duration: '2 jours',
          difficulty: 'ADVANCED',
          maxSpots: 12,
          availableSpots: 8,
          instructor: 'Sarah Chen',
          location: 'Salle de formation A',
          isOnline: false,
          price: 890,
          tags: ['React', 'JavaScript', 'Frontend', 'Performance'],
          requirements: ['Connaissance de base de React', 'JavaScript ES6+'],
          objectives: [
            'Maîtriser les hooks personnalisés',
            'Optimiser les performances avec React.memo',
            'Gérer l\'état complexe avec useReducer',
            'Implémenter le lazy loading'
          ],
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
          endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Leadership et Management d\'Équipe',
          description: 'Développez vos compétences de leadership pour manager efficacement vos équipes.',
          category: 'Management',
          duration: '3 jours',
          difficulty: 'INTERMEDIATE',
          maxSpots: 15,
          availableSpots: 3,
          instructor: 'Marc Dubois',
          location: 'Centre de formation externe',
          isOnline: false,
          price: 1200,
          tags: ['Leadership', 'Management', 'Communication', 'RH'],
          requirements: ['Expérience en management ou responsabilité d\'équipe'],
          objectives: [
            'Développer son style de leadership',
            'Motiver et fédérer une équipe',
            'Gérer les conflits',
            'Conduire le changement'
          ],
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Docker et Kubernetes - Déploiement Moderne',
          description: 'Apprenez à containeriser et déployer vos applications avec Docker et Kubernetes.',
          category: 'DevOps',
          duration: '5 jours',
          difficulty: 'INTERMEDIATE',
          maxSpots: 10,
          availableSpots: 10,
          instructor: 'Alex Rodriguez',
          location: 'En ligne',
          isOnline: true,
          price: 1500,
          tags: ['Docker', 'Kubernetes', 'DevOps', 'Cloud'],
          requirements: ['Connaissance de base en Linux', 'Expérience développement'],
          objectives: [
            'Maîtriser Docker et les conteneurs',
            'Déployer sur Kubernetes',
            'Mettre en place CI/CD',
            'Monitoring et observabilité'
          ],
          startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Communication Efficace et Présentation',
          description: 'Améliorez vos compétences de communication orale et écrite.',
          category: 'Communication',
          duration: '1 jour',
          difficulty: 'BEGINNER',
          maxSpots: 20,
          availableSpots: 15,
          instructor: 'Julie Martin',
          location: 'Salle de formation B',
          isOnline: false,
          price: 350,
          tags: ['Communication', 'Présentation', 'Soft Skills'],
          requirements: ['Aucun prérequis'],
          objectives: [
            'Structurer ses présentations',
            'Gérer le stress en public',
            'Adapter sa communication au public',
            'Utiliser les outils visuels'
          ],
          startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        }
      ];

      const createdTrainings = [];
      for (const trainingData of sampleTrainings) {
        const training = await prisma.training.create({ data: trainingData });
        createdTrainings.push(training);
      }

      logger.info('Sample trainings generated', { count: createdTrainings.length });
      return createdTrainings;
    } catch (error) {
      logger.logError(error, { context: 'generateSampleTrainings' });
      throw error;
    }
  }

  // Ajouter des recommandations personnalisées
  async addRecommendations(trainings, userId) {
    try {
      // Récupérer le profil utilisateur pour personnaliser
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { department: true, role: true }
      });

      // Logique de recommandation basée sur le département et rôle
      const recommendationRules = {
        'Développement': ['React', 'JavaScript', 'Docker', 'DevOps'],
        'Management': ['Leadership', 'Communication', 'RH'],
        'RH': ['Communication', 'Leadership', 'Management'],
        'Commercial': ['Communication', 'Négociation', 'CRM']
      };

      const userTags = recommendationRules[user?.department] || [];

      return trainings.map(training => ({
        ...training,
        recommended: training.tags.some(tag => userTags.includes(tag))
      }));
    } catch (error) {
      logger.logError(error, { context: 'addRecommendations', userId });
      return trainings.map(t => ({ ...t, recommended: false }));
    }
  }

  // S'inscrire à une formation
  async enrollTraining(userId, trainingId) {
    try {
      // Vérifier que la formation existe et a des places
      const training = await prisma.training.findUnique({
        where: { id: trainingId }
      });

      if (!training) {
        throw new Error('Formation non trouvée');
      }

      if (training.availableSpots <= 0) {
        throw new Error('Plus de places disponibles');
      }

      // Vérifier si l'utilisateur n'est pas déjà inscrit
      const existingEnrollment = await prisma.userTraining.findUnique({
        where: {
          userId_trainingId: {
            userId,
            trainingId
          }
        }
      });

      if (existingEnrollment) {
        throw new Error('Vous êtes déjà inscrit à cette formation');
      }

      // Créer l'inscription
      const enrollment = await prisma.userTraining.create({
        data: {
          userId,
          trainingId,
          status: 'ENROLLED'
        }
      });

      // Décrémenter les places disponibles
      await prisma.training.update({
        where: { id: trainingId },
        data: {
          availableSpots: {
            decrement: 1
          }
        }
      });

      // Créer une notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'TRAINING_REMINDER',
          title: 'Inscription confirmée',
          message: `Votre inscription à "${training.title}" a été confirmée.`,
          data: { trainingId, enrollmentId: enrollment.id }
        }
      });

      // Invalider les caches
      await redis.flushPattern('training_catalog:*');
      await redis.del(`user_trainings:${userId}`);

      logger.info('Training enrollment created', {
        userId,
        trainingId,
        enrollmentId: enrollment.id
      });

      return enrollment;
    } catch (error) {
      logger.logError(error, { context: 'enrollTraining', userId, trainingId });
      throw error;
    }
  }

  // Récupérer les formations d'un utilisateur
  async getUserTrainings(userId) {
    try {
      const cacheKey = `user_trainings:${userId}`;
      let userTrainings = await redis.get(cacheKey);

      if (!userTrainings) {
        userTrainings = await prisma.userTraining.findMany({
          where: { userId },
          include: {
            training: true
          },
          orderBy: { enrolledAt: 'desc' }
        });

        // Cache pour 15 minutes
        await redis.set(cacheKey, userTrainings, 900);
      }

      return userTrainings;
    } catch (error) {
      logger.logError(error, { context: 'getUserTrainings', userId });
      throw error;
    }
  }

  // Mettre à jour le progrès d'une formation
  async updateTrainingProgress(userId, trainingId, progress, score = null) {
    try {
      const enrollment = await prisma.userTraining.update({
        where: {
          userId_trainingId: {
            userId,
            trainingId
          }
        },
        data: {
          progress: Math.min(Math.max(progress, 0), 100), // Entre 0 et 100
          score,
          status: progress >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
          ...(progress >= 100 && { completedAt: new Date() })
        }
      });

      // Invalider le cache
      await redis.del(`user_trainings:${userId}`);

      logger.info('Training progress updated', {
        userId,
        trainingId,
        progress,
        status: enrollment.status
      });

      return enrollment;
    } catch (error) {
      logger.logError(error, { context: 'updateTrainingProgress', userId, trainingId });
      throw error;
    }
  }
}

module.exports = new TrainingService();