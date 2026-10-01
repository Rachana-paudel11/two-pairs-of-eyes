import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/auth.js';

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

// ── Security headers ──
app.use(helmet({
  hsts: IS_PRODUCTION  // HSTS only in production
}));

// ── Trust proxy in production (behind Nginx / Caddy) ──
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

// ── CORS allow-list ──
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true
}));

// ── Body parser ──
app.use(express.json());

// ── Rate limiting on auth routes ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per window per IP (covers both login + register)
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

// Routes
app.use('/api/reports', reportRoutes);
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  // CORS errors surface here
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }
  console.error('[Unhandled Error]:', err.message);
  res.status(500).json({
    success: false,
    error: IS_PRODUCTION ? 'Internal Server Error' : (err.message || 'Internal Server Error')
  });
});

// Start Server
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] API Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[Server Failed to start]:', err.message);
    process.exit(1);
  }
}

// Export app for testing before calling start()
export { app };

start();
