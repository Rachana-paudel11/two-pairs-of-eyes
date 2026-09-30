import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/auth.js';
import { securityHeaders } from './middlewares/securityHeaders.js';
import { logSecurityEvent } from './utils/logger.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers Middleware (MIME-sniffing, framing, referrer)
app.use(securityHeaders);

// Configurable CORS restriction
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const configuredOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
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
      return callback(new Error('Not allowed by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parsing with strict size limit to prevent Denial-of-Service attacks
app.use(express.json({ limit: '100kb' }));

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

// Safe Global Error Handler (prevents stack trace & internal leakage)
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message);

  const status = err.status || (err.message?.includes('CORS') ? 403 : 500);
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(status).json({
    success: false,
    error: isProduction || status >= 500 ? 'Internal Server Error' : err.message
  });
});

// Start Server
async function start() {
  try {
    await connectDB();
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

export default app;
