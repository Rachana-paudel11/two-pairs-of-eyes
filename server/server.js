import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/auth.js';
import { securityHeaders } from './middlewares/securityHeaders.js';
import { logSecurityEvent } from './utils/logger.js';
import adminAuthRoutes, { ensureDefaultAdmin } from './routes/adminAuthRoutes.js';
import adminScenarioRoutes from './routes/adminScenarioRoutes.js';
import { ScenarioRepository } from './repositories/ScenarioRepository.js';

// Load environment variables
dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In production, JWT_SECRET is mandatory
if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  console.error('[Server] FATAL: JWT_SECRET environment variable is required in production.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers (Helmet + custom headers preserving WebGL asset compatibility)
app.use(helmet({
  hsts: IS_PRODUCTION,
  contentSecurityPolicy: false // Kept false so local Three.js WebGL shaders and model assets are never blocked
}));
app.use(securityHeaders);

// Trust proxy in production (behind Nginx / Caddy / reverse proxy)
if (IS_PRODUCTION) {
  app.set('trust proxy', 1);

  // Redirect HTTP → HTTPS when behind a reverse proxy
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Configurable CORS whitelist
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const originEnv = process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN;
const configuredOrigins = originEnv
  ? originEnv.split(',').map((s) => s.trim()).filter(Boolean)
  : defaultAllowedOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-side tests)
      if (!origin || configuredOrigins.includes(origin)) {
        return callback(null, true);
      }
      logSecurityEvent({
        action: 'CORS_BLOCKED',
        outcome: 'WARNING',
        ip: 'REMOTE',
        details: { blockedOrigin: origin }
      });
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parsing with strict size limit to prevent Denial-of-Service attacks
app.use(express.json({ limit: '100kb' }));

// Express rate limiting on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again after 15 minutes.' }
});
app.use('/api/auth', authLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Two Pairs of Eyes - Safety Simulation Backend',
    timestamp: new Date().toISOString()
  });
});

// Simulation Scenarios Public Feed (Hybrid backend source)
app.get('/api/scenarios', async (req, res) => {
  try {
    const data = await ScenarioRepository.getAll();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Routes
app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin/scenarios', adminScenarioRoutes);

// Safe Global Error Handler (prevents stack trace & internal leakage)
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }

  console.error('[Server Error]:', err.message);

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: IS_PRODUCTION || status >= 500 ? 'Internal Server Error' : err.message
  });
});

// Start Server
async function start() {
  try {
    try {
      await connectDB();
      console.log('[Server] MongoDB connected successfully.');
    } catch (dbErr) {
      console.warn('[Server] Notice: MongoDB is not running locally (127.0.0.1:27017).');
      console.warn('[Server] Running in resilient in-memory mode. Start the MongoDB service to enable permanent persistence.');
    }

    await ScenarioRepository.init();
    await ensureDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[Server Failed to start]:', err.message);
    process.exit(1);
  }
}

// Only start listening if executed directly (enables clean testing imports)
if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app };
export default app;
