import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/auth.js';
import adminAuthRoutes, { ensureDefaultAdmin } from './routes/adminAuthRoutes.js';
import adminScenarioRoutes from './routes/adminScenarioRoutes.js';
import { ScenarioRepository } from './repositories/ScenarioRepository.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
async function start() {
  try {
    await connectDB();
    await ScenarioRepository.init();
    await ensureDefaultAdmin();
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] API Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('[Server Failed to start]:', err.message);
    process.exit(1);
  }
}

start();
