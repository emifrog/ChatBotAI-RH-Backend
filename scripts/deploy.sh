#!/bin/bash

# Script de déploiement pour production
set -e

echo "🚀 Déploiement Chatbot RH Backend..."

# Variables
ENV=${1:-production}
BRANCH=${2:-main}

echo "📋 Environnement: $ENV"
echo "🌿 Branche: $BRANCH"

# Arrêter l'ancien serveur
echo "⏹️ Arrêt de l'ancien serveur..."
pm2 stop chatbot-rh-backend || true

# Mise à jour du code
echo "📥 Mise à jour du code..."
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

# Installation des dépendances
echo "📦 Installation des dépendances..."
npm ci --only=production

# Migrations base de données
echo "🗄️ Migrations base de données..."
npx prisma migrate deploy
npx prisma generate

# Tests rapides
echo "🧪 Tests de santé..."
npm run test:health || echo "⚠️ Tests de santé échoués"

# Redémarrage du serveur
echo "🔄 Redémarrage du serveur..."
pm2 start ecosystem.config.js --env $ENV
pm2 save

# Vérification
echo "✅ Vérification du déploiement..."
sleep 5
curl -f http://localhost:5000/health || {
    echo "❌ Échec de la vérification de santé"
    exit 1
}

echo "🎉 Déploiement terminé avec succès !"
echo "📊 Status: pm2 status"
echo "📋 Logs: pm2 logs chatbot-rh-backend"