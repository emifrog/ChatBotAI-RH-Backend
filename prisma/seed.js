// Script de seed simplifié pour données de démonstration

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Nettoyer la base (ordre important pour les relations)
    await prisma.feedback.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany();

    // Créer les utilisateurs de démo
    const marie = await prisma.user.create({
      data: {
        email: 'marie.dupont@entreprise.fr',
        password: await bcrypt.hash('demo123', 10),
        name: 'Marie Dupont',
        firstName: 'Marie',
        lastName: 'Dupont',
        department: 'Marketing',
        role: 'employee',
        antibiaId: 'emp-001',
        manager: 'Pierre Martin',
        hireDate: new Date('2021-03-15'),
        isActive: true
      }
    });

    const paul = await prisma.user.create({
      data: {
        email: 'paul.martin@entreprise.fr',
        password: await bcrypt.hash('demo123', 10),
        name: 'Paul Martin',
        firstName: 'Paul',
        lastName: 'Martin',
        department: 'Informatique',
        role: 'employee',
        antibiaId: 'emp-002',
        manager: 'Sophie Bernard',
        hireDate: new Date('2019-09-01'),
        isActive: true
      }
    });

    const admin = await prisma.user.create({
      data: {
        email: 'admin@entreprise.fr',
        password: await bcrypt.hash('admin123', 10),
        name: 'Admin RH',
        firstName: 'Admin',
        lastName: 'RH',
        department: 'Ressources Humaines',
        role: 'admin',
        antibiaId: 'admin-001',
        isActive: true
      }
    });

    // Créer l'utilisateur démo pour les tests
    const demo = await prisma.user.create({
      data: {
        email: 'demo@company.com',
        password: await bcrypt.hash('demo', 10),
        name: 'Utilisateur Démo',
        firstName: 'Utilisateur',
        lastName: 'Démo',
        department: 'Démonstration',
        role: 'employee',
        antibiaId: 'demo-001',
        manager: 'Manager Démo',
        hireDate: new Date('2024-01-01'),
        isActive: true
      }
    });

    console.log('✅ Created 4 users (including demo user)');

    // Créer une conversation simple pour Marie
    const conversation = await prisma.conversation.create({
      data: {
        userId: marie.id,
        title: 'Demande de congés été 2025',
        status: 'ACTIVE',
        metadata: {
          lastIntent: 'leave_request'
        }
      }
    });

    // Créer des messages pour la conversation
    const message1 = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: marie.id,
        type: 'USER',
        content: 'Bonjour, je voudrais poser des congés pour cet été',
        intent: 'leave_request',
        confidence: 0.95
      }
    });

    const message2 = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        type: 'BOT',
        content: 'Bonjour Marie ! Je serais ravi de vous aider avec votre demande de congés. Pour quelles dates souhaitez-vous poser vos congés ?',
        intent: 'leave_request'
      }
    });

    console.log('✅ Created 1 conversation with 2 messages');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📝 Test accounts:');
    console.log('- marie.dupont@entreprise.fr / demo123');
    console.log('- paul.martin@entreprise.fr / demo123');
    console.log('- admin@entreprise.fr / admin123');
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });