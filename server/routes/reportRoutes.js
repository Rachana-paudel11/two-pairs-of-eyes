import { Router } from 'express';
import {
  createReport,
  getAllReports,
  getReportById,
  getStats,
  getLeaderboard
} from '../controllers/reportController.js';
import { requireAdminAuth } from '../middlewares/adminAuth.js';

const router = Router();

router.post('/', createReport);
router.get('/', requireAdminAuth, getAllReports);
router.get('/stats', getStats);
router.get('/leaderboard', getLeaderboard);
router.get('/:id', requireAdminAuth, getReportById);

export default router;
