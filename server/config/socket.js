/**
 * Socket.io Configuration - Real-time events handler
 */
const jwt = require('jsonwebtoken');

module.exports = (io) => {
  // Middleware: Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rescue_wings_secret');
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User ${socket.userId} connected`);

    // Join personal room for direct messages
    socket.join(`user_${socket.userId}`);

    // Update user location
    socket.on('update_location', async (data) => {
      socket.broadcast.emit('volunteer_location_updated', {
        userId: socket.userId,
        location: data.location,
      });
    });

    // Join rescue request room for real-time updates
    socket.on('join_rescue_room', (requestId) => {
      socket.join(`rescue_${requestId}`);
    });

    // Leave rescue request room
    socket.on('leave_rescue_room', (requestId) => {
      socket.leave(`rescue_${requestId}`);
    });

    // Typing indicator for chat
    socket.on('typing', ({ receiverId }) => {
      io.to(`user_${receiverId}`).emit('user_typing', { userId: socket.userId });
    });

    socket.on('stop_typing', ({ receiverId }) => {
      io.to(`user_${receiverId}`).emit('user_stop_typing', { userId: socket.userId });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 User ${socket.userId} disconnected`);
    });
  });
};
