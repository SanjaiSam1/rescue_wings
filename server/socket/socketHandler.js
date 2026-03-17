const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getChatRoomId = (userA, userB) => {
  return `chat_${[String(userA), String(userB)].sort().join('_')}`;
};

const onlineSocketCountByUser = new Map();

const emitPresenceUpdate = (io, userId, isOnline, lastSeen) => {
  io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').to('citizen').to('role_citizen').emit('presence:update', {
    userId: String(userId),
    isOnline: Boolean(isOnline),
    lastSeen,
  });
};

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake?.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rescue_wings_secret');
      const user = await User.findById(decoded.id).select('_id role isActive');
      if (!user || !user.isActive) return next(new Error('User not active'));

      socket.userId = String(user._id);
      socket.userRole = user.role;
      return next();
    } catch (error) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.userId);
    const previousCount = onlineSocketCountByUser.get(userId) || 0;
    onlineSocketCountByUser.set(userId, previousCount + 1);

    if (previousCount === 0) {
      const now = new Date();
      User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: now }, { new: false }).catch(() => {});
      emitPresenceUpdate(io, userId, true, now);
    }

    // Join personal and role rooms immediately.
    socket.join(`user_${socket.userId}`);
    socket.join(socket.userRole);
    socket.join(`role_${socket.userRole}`);

    socket.on('join_role_room', ({ role, userId }) => {
      if (role && role === socket.userRole) {
        socket.join(role);
        socket.join(`role_${role}`);
      }
      if (userId && String(userId) === socket.userId) {
        socket.join(`user_${socket.userId}`);
      }
    });

    socket.on('leave_role_room', ({ role }) => {
      if (role && role === socket.userRole) {
        socket.leave(role);
        socket.leave(`role_${role}`);
      }
    });

    socket.on('join_user_room', ({ userId }) => {
      if (userId && String(userId) === socket.userId) {
        socket.join(`user_${socket.userId}`);
      }
    });

    socket.on('leave_user_room', ({ userId }) => {
      if (userId && String(userId) === socket.userId) {
        socket.leave(`user_${socket.userId}`);
      }
    });

    socket.on('join_rescue_room', (requestId) => {
      if (!requestId) return;
      socket.join(`rescue_${requestId}`);
    });

    socket.on('leave_rescue_room', (requestId) => {
      if (!requestId) return;
      socket.leave(`rescue_${requestId}`);
    });

    socket.on('join_chat_room', ({ userA, userB }) => {
      if (!userA || !userB) return;
      const roomId = getChatRoomId(userA, userB);
      socket.join(roomId);
    });

    socket.on('leave_chat_room', ({ userA, userB }) => {
      if (!userA || !userB) return;
      const roomId = getChatRoomId(userA, userB);
      socket.leave(roomId);
    });

    socket.on('typing', ({ receiverId, userA, userB }) => {
      if (userA && userB) {
        const roomId = getChatRoomId(userA, userB);
        socket.to(roomId).emit('user_typing', { userId: socket.userId });
        return;
      }
      if (receiverId) {
        io.to(`user_${receiverId}`).emit('user_typing', { userId: socket.userId });
      }
    });

    socket.on('stop_typing', ({ receiverId, userA, userB }) => {
      if (userA && userB) {
        const roomId = getChatRoomId(userA, userB);
        socket.to(roomId).emit('user_stop_typing', { userId: socket.userId });
        return;
      }
      if (receiverId) {
        io.to(`user_${receiverId}`).emit('user_stop_typing', { userId: socket.userId });
      }
    });

    socket.on('disconnect', () => {
      const current = onlineSocketCountByUser.get(userId) || 0;
      const nextCount = Math.max(0, current - 1);

      if (nextCount === 0) {
        onlineSocketCountByUser.delete(userId);
        const now = new Date();
        User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now }, { new: false }).catch(() => {});
        emitPresenceUpdate(io, userId, false, now);
      } else {
        onlineSocketCountByUser.set(userId, nextCount);
      }
    });
  });
};
