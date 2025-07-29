# Chatbot RH Backend

API backend complète pour chatbot RH avec intégration Antibia (simulation).

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+ LTS
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Cloner et installer
git clone <repo>
cd chatbot-rh-backend
npm install

# Configuration environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Base de données
npx prisma migrate dev --name init
npm run db:seed

# Démarrer en développement
npm run dev
```

### URLs Importantes
- API: http://localhost:5000
- Health: http://localhost:5000/health
- Prisma Studio: npx prisma studio

## 📁 Structure du Projet

```
src/
├── config/          # Configurations (DB, Redis, Logger)
├── controllers/     # Contrôleurs API
├── middleware/      # Middleware Express
├── routes/          # Routes API
├── services/        # Logique métier
├── socket/          # Gestion Socket.IO
└── utils/           # Utilitaires
```

## 🔧 Scripts Disponibles

- `npm run dev` - Développement avec hot reload
- `npm run start` - Production
- `npm run db:migrate` - Migrations Prisma
- `npm run db:seed` - Données d'exemple
- `npm run db:reset` - Reset complet DB

## 🛡️ Sécurité

- Authentification JWT avec refresh tokens
- Rate limiting par endpoint
- Validation des entrées
- Logs d'audit complets
- Chiffrement des données sensibles

## 📊 Monitoring

- Health checks: `/health`
- Métriques: `/metrics` 
- Logs structurés avec Winston
- Support Prometheus/Grafana

## 🧪 Tests

```bash
npm test                 # Tests unitaires
npm run test:integration # Tests d'intégration
npm run test:e2e        # Tests end-to-end
```

## 🚀 Déploiement

### Docker

```bash
# Build
docker build -t chatbot-rh-backend .

# Run
docker-compose up -d
```

### Variables d'Environnement

```env
# Base de données
DATABASE_URL="postgresql://user:pass@localhost:5432/chatbot_rh"
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# Application
NODE_ENV="production"
PORT=5000
CORS_ORIGIN="https://your-frontend.com"

# Antibia (à configurer)
ANTIBIA_API_URL="https://api.antibia.com"
ANTIBIA_API_KEY="your-antibia-key"
```

## 📈 Performance

- Cache Redis pour les données fréquentes
- Connexions DB optimisées avec pooling
- Rate limiting intelligent
- Compression gzip
- Assets statiques optimisés

## 🔗 API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/profile` - Profil utilisateur

### Chat
- `GET /api/chat/conversations` - Conversations
- `GET /api/chat/conversations/:id/messages` - Messages
- `POST /api/chat/feedback` - Feedback

### Congés
- `GET /api/leaves/balance` - Solde congés
- `POST /api/leaves/request` - Demande congés
- `GET /api/leaves/requests` - Historique

### Socket.IO Events
- `send_message` - Envoyer message
- `quick_action` - Action rapide
- `message_feedback` - Feedback message

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir LICENSE file