const jwt = require('jsonwebtoken');
const ChatHandler = require('./chatHandler');
const logger = require('../config/logger');

const initializeSocket = (server, redis) => {
  const io = require('socket.io')(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const chatHandler = new ChatHandler(io, redis);

  // Middleware d'authentification Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Token d\'authentification requis'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Vérifier si le token est en blacklist
      const blacklisted = await redis.exists(`blacklist:${token}`);
      if (blacklisted) {
        return next(new Error('Token invalide'));
      }

      socket.userId = decoded.userId;
      socket.userInfo = decoded;
      next();
    } catch (error) {
      logger.logError(error, { context: 'socket_auth' });
      next(new Error('Authentification échouée'));
    }
  });

  // Gestionnaire de connexion
  io.on('connection', (socket) => {
    chatHandler.handleConnection(socket);
  });

  // Gestion des erreurs Socket.IO
  io.engine.on("connection_error", (err) => {
    logger.logError(err, { context: 'socket_connection_error' });
  });

  logger.info('Socket.IO server initialized');
  return io;
};

module.exports = initializeSocket;