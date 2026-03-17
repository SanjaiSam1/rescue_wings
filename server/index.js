/**
 * Rescue Wings - Main Server Entry Point
 */
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { loadRuntimeConfig } = require('./config/runtimeConfig');

// Always resolve .env relative to this file so npm --prefix and nested cwd still work.
dotenv.config({ path: path.join(__dirname, '.env') });
loadRuntimeConfig();

const authRoutes = require('./routes/auth');
const setupRoutes = require('./routes/setup');
const notificationRoutes = require('./routes/notifications');
const rescueRoutes = require('./routes/rescue');
const volunteerRoutes = require('./routes/volunteer');
const alertRoutes = require('./routes/alerts');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const attachSocketHandlers = require('./socket/socketHandler');
const RescueRequest = require('./models/RescueRequest');
const Volunteer = require('./models/Volunteer');
const { ensureDefaultAdmin } = require('./utils/seedDefaultAdmin');
const { ensureDemoUsers } = require('./utils/seedDemoUsers');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const isServerless = Boolean(process.env.VERCEL);

const createNoopIo = () => {
  const chain = {
    to: () => chain,
    emit: () => chain,
    on: () => chain,
  };
  return chain;
};

let server = null;
let io = createNoopIo();

if (!isServerless) {
  server = http.createServer(app);
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
}

app.set('io', io);

// Middleware
const resolveAllowedOrigins = () => {
  const fromEnv = String(process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (process.env.VERCEL_URL) {
    fromEnv.push(`https://${process.env.VERCEL_URL}`);
  }

  return Array.from(new Set(fromEnv));
};
app.use(cors({ origin: (origin, callback) => {
  const allowedOrigins = resolveAllowedOrigins();
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('CORS blocked by server policy'));
}, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 10000,
  skip: (req) => req.path === '/health',
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isProduction ? 10 : 1000),
  skipSuccessfulRequests: true,
});
app.use('/api/auth/', authLimiter);

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rescue', rescueRoutes);
app.use('/api/volunteer', volunteerRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({
  status: 'OK',
  message: 'Rescue Wings API running',
  dbConnected: mongoose.connection.readyState === 1,
}));

// Serve built frontend for packaged/electron runtime.
const resolveClientDistPath = () => {
  const candidates = [
    process.env.CLIENT_DIST_PATH,
    path.join(__dirname, '..', 'client', 'dist'),
    path.join(__dirname, 'client', 'dist'),
    process.resourcesPath ? path.join(process.resourcesPath, 'client', 'dist') : null,
    path.join(process.cwd(), 'client', 'dist'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
};

const clientDistPath = resolveClientDistPath();
if (isProduction && clientDistPath) {
  console.log(`[frontend] Serving static files from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else if (isProduction) {
  console.warn('[frontend] No client dist path found; root routes may return Cannot GET /.');
}

if (!isProduction || !clientDistPath) {
  app.get('/', (req, res) => {
    res.json({
      status: 'OK',
      message: 'Rescue Wings backend is running',
      docs: '/api/health',
    });
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (!isServerless) {
  attachSocketHandlers(io);
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rescue-wings');
    console.log('MongoDB connected');
    return true;
  } catch (error) {
    console.error('MongoDB error:', error.message);
    console.warn('Server started in setup mode. Open /setup and save valid configuration.');
    return false;
  }
};

const PORT = process.env.PORT || 5000;

const toRad = (deg) => (deg * Math.PI) / 180;
const distanceMeters = (a, b) => {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const findNearestAvailableVolunteer = async (request) => {
  const volunteers = await Volunteer.find({
    verificationStatus: 'approved',
    availability: 'available',
  }).populate('userId', 'name phone email location');

  const candidates = volunteers
    .filter((v) => Array.isArray(v.userId?.location?.coordinates) && v.userId.location.coordinates.length === 2)
    .map((v) => ({
      volunteer: v,
      distance: distanceMeters(request.location.coordinates, v.userId.location.coordinates),
    }))
    .sort((a, b) => a.distance - b.distance);

  return candidates[0] || null;
};

const startEscalationMonitor = () => {
  setInterval(async () => {
    try {
      const now = new Date();
      const threshold = new Date(Date.now() - 10 * 60 * 1000);

      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredRequests = await RescueRequest.find({
        status: 'pending',
        assignedVolunteer: null,
        createdAt: { $lte: expiredThreshold },
      }).populate('userId', 'name phone email');

      for (const expiredRequest of expiredRequests) {
        expiredRequest.status = 'failed';
        expiredRequest.resolvedAt = now;
        expiredRequest.statusHistory.push({
          status: 'failed',
          note: 'Auto-expired after 24 hours without volunteer response.',
        });
        await expiredRequest.save();

        io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('rescue_request_updated', expiredRequest);
        io.to(`user_${expiredRequest.userId?._id}`).emit('your_request_updated', expiredRequest);
        io.to(`user_${expiredRequest.userId?._id}`).emit('request_status_notification', {
          requestId: expiredRequest._id,
          status: 'failed',
          message: 'Your SOS request expired after 24 hours without volunteer response.',
          timestamp: now,
        });
      }

      const escalated = await RescueRequest.find({
        status: 'pending',
        escalationNotified: false,
        createdAt: { $lte: threshold },
      }).populate('userId', 'name phone email');

      if (!escalated.length) return;

      const ids = escalated.map((r) => r._id);
      await RescueRequest.updateMany(
        { _id: { $in: ids } },
        { $set: { escalationNotified: true, escalationNotifiedAt: now } }
      );

      for (const request of escalated) {
        io.to('admin').to('role_admin').emit('escalation_alert', {
          requestId: request._id,
          citizenName: request.userId?.name,
          disasterType: request.disasterType,
          urgencyLevel: request.urgencyLevel,
          message: 'No volunteer accepted this SOS request within 10 minutes.',
          createdAt: request.createdAt,
        });

        if (!request.assignedVolunteer) {
          const nearest = await findNearestAvailableVolunteer(request);
          if (nearest?.volunteer?.userId?._id) {
            request.assignedVolunteer = nearest.volunteer.userId._id;
            request.assignedAt = now;
            request.acceptedAt = now;
            request.status = 'accepted';
            request.statusHistory.push({
              status: 'accepted',
              note: `Auto-assigned nearest available volunteer in ${Math.round(nearest.distance)} meters after 10-minute timeout.`,
            });
            await request.save();
            await request.populate('assignedVolunteer', 'name phone email');

            io.to('admin').to('role_admin').to('volunteer').to('role_volunteer').emit('rescue_request_updated', request);
            io.to(`user_${request.userId?._id}`).emit('your_request_updated', request);
            io.to(`user_${request.userId?._id}`).emit('request_status_notification', {
              requestId: request._id,
              status: 'accepted',
              message: 'A nearby volunteer was auto-assigned to your SOS request.',
              timestamp: now,
            });
            io.to(`user_${nearest.volunteer.userId._id}`).emit('assigned_mission_updated', request);
          }
        }
      }
    } catch (error) {
      console.error('Escalation monitor error:', error.message);
    }
  }, 60 * 1000);
};

connectDB().then((dbConnected) => {
  if (dbConnected) {
    const shouldSeedDemoUsers = String(process.env.SEED_DEMO_USERS || '').toLowerCase() === 'true';

    ensureDefaultAdmin()
      .then((result) => {
        if (result.created) {
          console.log(`[seed] Default admin created: ${result.email}`);
        }
      })
      .catch((error) => {
        console.warn('[seed] Failed to ensure default admin:', error.message);
      });

    if (shouldSeedDemoUsers) {
      ensureDemoUsers()
        .then(() => {
          console.log('[seed] Demo users ensured for packaged desktop runtime.');
        })
        .catch((error) => {
          console.warn('[seed] Failed to ensure demo users:', error.message);
        });
    }

    if (!isServerless) {
      startEscalationMonitor();
    }
  }

  if (!isServerless) {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  }
});

module.exports = { app, io };
