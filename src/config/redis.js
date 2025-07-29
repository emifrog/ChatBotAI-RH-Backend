const Redis = require('ioredis');

class RedisConfig {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  connect() {
    try {
      this.client = new Redis(process.env.REDIS_URL, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        password: process.env.REDIS_PASSWORD || undefined,
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connecté');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        console.error('❌ Erreur Redis:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('🔌 Redis déconnecté');
        this.isConnected = false;
      });

      return this.client;
    } catch (error) {
      console.error('❌ Erreur initialisation Redis:', error);
      return null;
    }
  }

  // Méthodes utilitaires
  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;
    try {
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      await this.client.setex(key, ttl, value);
      return true;
    } catch (error) {
      console.error('Erreur Redis SET:', error);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      console.error('Erreur Redis GET:', error);
      return null;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Erreur Redis DEL:', error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Erreur Redis EXISTS:', error);
      return false;
    }
  }

  async flushPattern(pattern) {
    if (!this.isConnected) return 0;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return keys.length;
    } catch (error) {
      console.error('Erreur Redis FLUSH PATTERN:', error);
      return 0;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}

module.exports = new RedisConfig();