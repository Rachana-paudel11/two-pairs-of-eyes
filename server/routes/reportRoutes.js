import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.js';
import {
  createReport,
  getAllReports,
  getReportById,
  getStats,
  getLeaderboard
} from '../controllers/reportController.js';

const router = Router();

// POST /api/reports — any authenticated user can submit their own report
router.post('/', authenticate, createReport);

// GET /api/reports — trainers only (all reports)
router.get('/', authenticate, requireRole('trainer'), getAllReports);

// GET /api/reports/stats — trainers only
router.get('/stats', authenticate, requireRole('trainer'), getStats);

// GET /api/reports/leaderboard — trainers only
router.get('/leaderboard', authenticate, requireRole('trainer'), getLeaderboard);

// GET /api/reports/:id — authenticated (trainee can read own, trainer can read any)
router.get('/:id', authenticate, getReportById);

export default router;
