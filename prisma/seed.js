const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding de la base de données...');

  // Créer des utilisateurs d'exemple
  const users = [
    {
      email: 'marie.dubois@company.com',
      password: await bcrypt.hash('password123', 12),
      name: 'Marie Dubois',
      firstName: 'Marie',
      lastName: 'Dubois',
      department: 'Développement',
      role: 'Développeur Senior',
      manager: 'Jean Martin',
      hireDate: new Date('2020-03-15'),
      phone: '06.12.34.56.78',
      isActive: true
    },
    {
      email: 'pierre.martin@company.com',
      password: await bcrypt.hash('password123', 12),
      name: 'Pierre Martin',
      firstName: 'Pierre',
      lastName: 'Martin',
      department: 'RH',
      role: 'Responsable RH',
      hireDate: new Date('2018-01-10'),
      phone: '06.98.76.54.32',
      isActive: true
    },
    {
      email: 'admin@company.com',
      password: await bcrypt.hash('admin123', 12),
      name: 'Administrateur',
      firstName: 'Admin',
      lastName: 'System',
      department: 'IT',
      role: 'Administrateur',
      hireDate: new Date('2017-06-01'),
      isActive: true
    }
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: userData,
      create: userData
    });

    console.log(`✅ Utilisateur créé: ${user.email}`);

    // Créer le solde de congés pour chaque utilisateur
    const currentYear = new Date().getFullYear();
    await prisma.leaveBalance.upsert({
      where: { userId: user.id },
      update: {
        paidLeave: 25,
        rtt: 12,
        sickLeave: 0,
        year: currentYear,
        lastUpdate: new Date()
      },
      create: {
        userId: user.id,
        paidLeave: 25,
        rtt: 12,
        sickLeave: 0,
        year: currentYear
      }
    });

    // Créer quelques demandes de congés d'exemple
    const leaveRequests = [
      {
        userId: user.id,
        type: 'PAID',
        startDate: new Date('2024-12-23'),
        endDate: new Date('2024-12-27'),
        days: 5,
        reason: 'Vacances de Noël',
        status: 'APPROVED',
        approvedBy: 'system',
        approvedAt: new Date()
      },
      {
        userId: user.id,
        type: 'RTT',
        startDate: new Date('2024-11-15'),
        endDate: new Date('2024-11-15'),
        days: 1,
        reason: 'RTT',
        status: 'APPROVED',
        approvedBy: 'system',
        approvedAt: new Date()
      }
    ];

    for (const requestData of leaveRequests) {
      await prisma.leaveRequest.upsert({
        where: {
          userId_startDate_endDate: {
            userId: requestData.userId,
            startDate: requestData.startDate,
            endDate: requestData.endDate
          }
        },
        update: requestData,
        create: requestData
      });
    }
  }

  // Créer des formations d'exemple
  const trainings = [
    {
      title: 'React Avancé - Hooks et Performance',
      description: 'Maîtrisez les hooks avancés de React et optimisez les performances.',
      category: 'Développement',
      duration: '2 jours',
      difficulty: 'ADVANCED',
      maxSpots: 12,
      availableSpots: 8,
      instructor: 'Sarah Chen',
      location: 'Salle A',
      isOnline: false,
      price: 890,
      tags: ['React', 'JavaScript', 'Performance'],
      requirements: ['React de base', 'JavaScript ES6+'],
      objectives: ['Hooks personnalisés', 'Optimisation', 'State management'],
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      isActive: true
    },
    {
      title: 'Leadership et Management',
      description: 'Développez vos compétences de leadership.',
      category: 'Management',
      duration: '3 jours',
      difficulty: 'INTERMEDIATE',
      maxSpots: 15,
      availableSpots: 3,
      instructor: 'Marc Dubois',
      location: 'Centre externe',
      isOnline: false,
      price: 1200,
      tags: ['Leadership', 'Management', 'Communication'],
      requirements: ['Expérience management'],
      objectives: ['Style de leadership', 'Motivation équipe', 'Gestion conflits'],
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
      isActive: true
    },
    {
      title: 'Communication Efficace',
      description: 'Améliorez vos compétences de communication.',
      category: 'Communication',
      duration: '1 jour',
      difficulty: 'BEGINNER',
      maxSpots: 20,
      availableSpots: 15,
      instructor: 'Julie Martin',
      location: 'Salle B',
      isOnline: false,
      price: 350,
      tags: ['Communication', 'Présentation'],
      requirements: ['Aucun'],
      objectives: ['Structurer présentations', 'Gérer stress', 'Adapter communication'],
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      isActive: true
    }
  ];

  for (const trainingData of trainings) {
    await prisma.training.upsert({
      where: { title: trainingData.title },
      update: trainingData,
      create: trainingData
    });
    console.log(`✅ Formation créée: ${trainingData.title}`);
  }

  // Créer des statistiques initiales
  await prisma.dailyStats.upsert({
    where: { date: new Date() },
    update: {
      totalUsers: users.length,
      activeUsers: users.length,
      totalMessages: 0,
      botMessages: 0
    },
    create: {
      date: new Date(),
      totalUsers: users.length,
      activeUsers: users.length,
      totalMessages: 0,
      botMessages: 0
    }
  });

  console.log('✅ Seeding terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });