const { PrismaClient } = require('@prisma/client');

class DatabaseConfig {
  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
      errorFormat: 'pretty',
    });
  }

  async connect() {
    try {
      await this.prisma.$connect();
      console.log('✅ Base de données connectée');
    } catch (error) {
      console.error('❌ Erreur connexion base de données:', error);
      process.exit(1);
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
    console.log('🔌 Base de données déconnectée');
  }

  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }

  // Méthodes utilitaires
  async cleanExpiredSessions() {
    const deleted = await this.prisma.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false }
        ]
      }
    });
    return deleted.count;
  }

  async cleanExpiredCache() {
    const deleted = await this.prisma.cacheEntry.deleteMany({
      where: { ttl: { lt: new Date() } }
    });
    return deleted.count;
  }
}

module.exports = new DatabaseConfig();