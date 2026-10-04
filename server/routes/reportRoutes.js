import { Router } from 'express';
import {
  createReport,
  getAllReports,
  getReportById,
  getStats,
  getLeaderboard
} from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';

const router = Router();

// Submit report: Authenticated users only (trainees can only submit for themselves)
router.post('/', requireAuth, createReport);

// View all reports: Trainers and Admins only
router.get('/', requireRole('trainer', 'admin', 'TRAINER', 'ADMIN', 'Supervisor', 'Administrator'), getAllReports);

// Aggregate stats: Authenticated users
router.get('/stats', requireAuth, getStats);

// Public leaderboard: Top scores with public metadata only
router.get('/leaderboard', getLeaderboard);

// View specific report: Authenticated (ownership verified in controller)
router.get('/:id', requireAuth, getReportById);

export default router;
