import { Router } from 'express';
import {
  createReport,
  getAllReports,
  getReportById,
  getStats,
  getLeaderboard
} from '../controllers/reportController.js';

const router = Router();

router.post('/', createReport);
router.get('/', getAllReports);
router.get('/stats', getStats);
router.get('/leaderboard', getLeaderboard);
router.get('/:id', getReportById);

export default router;
