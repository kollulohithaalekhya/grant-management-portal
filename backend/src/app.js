const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const prisma = require('./lib/prisma');
const authRoutes = require('./routes/auth');
const grantRoutes = require('./routes/grants');
const applicationRoutes = require('./routes/applications');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting is disabled under test so suites are not throttled.
if (!config.isTest) {
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: { success: false, message: 'Too many requests, please try again later.' },
    })
  );
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!config.isTest) {
  app.use(morgan('dev'));
}

/**
 * Liveness + readiness probe. Used by the compose healthcheck, so it reports
 * unhealthy when the database is unreachable.
 */
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    });
  } catch {
    return res.status(503).json({
      status: 'degraded',
      database: 'down',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    });
  }
});

const authLimiter = config.isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: { success: false, message: 'Too many auth attempts, please try again later.' },
    });

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/grants', grantRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
