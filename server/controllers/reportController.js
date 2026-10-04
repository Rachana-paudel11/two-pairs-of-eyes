import { InspectionReport } from '../models/InspectionReport.js';
import { Trainee } from '../models/Trainee.js';
import { validateReportPayload } from '../utils/validators.js';
import { logSecurityEvent } from '../utils/logger.js';

/**
 * Save a new inspection debrief report with result integrity verification.
 */
export async function createReport(req, res) {
  try {
    // 1. Verify result integrity and ownership against authenticated user
    const validation = validateReportPayload(req.body, req.user);
    if (!validation.valid) {
      logSecurityEvent({
        action: 'REPORT_SUBMISSION_REJECTED',
        outcome: 'FAILURE',
        userId: req.user?.traineeId || req.user?.sub || 'ANONYMOUS',
        ip: req.ip,
        details: { reason: validation.error }
      });

      const statusCode = validation.error.startsWith('Forbidden') ? 403 : 400;
      return res.status(statusCode).json({ success: false, error: validation.error });
    }

    const cleanData = validation.sanitizedData;

    // 2. Persist the sanitized report
    const report = new InspectionReport({
      ...cleanData,
      completedAt: new Date()
    });

    const savedReport = await report.save();

    // 3. Increment completed patrols for trainee
    await Trainee.findOneAndUpdate(
      { traineeId: cleanData.traineeId },
      {
        $setOnInsert: { name: cleanData.traineeName, role: 'trainee' },
        $inc: { patrolsCompleted: 1 }
      },
      { upsert: true, returnDocument: 'after' }
    );

    logSecurityEvent({
      action: 'REPORT_SUBMITTED',
      outcome: 'SUCCESS',
      userId: cleanData.traineeId,
      ip: req.ip,
      details: {
        reportId: savedReport._id.toString(),
        totalScore: cleanData.totalScore,
        passed: cleanData.passed
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Inspection report saved successfully',
      data: savedReport
    });
  } catch (error) {
    console.error('[createReport error]:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

/**
 * Retrieve inspection reports with bounded pagination (TRAINER / ADMIN only).
 */
export async function getAllReports(req, res) {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 20 : rawLimit), 100);

    const rawPage = parseInt(req.query.page, 10);
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const skip = (page - 1) * limit;

    const [reports, totalCount] = await Promise.all([
      InspectionReport.find()
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit),
      InspectionReport.countDocuments()
    ]);

    return res.json({
      success: true,
      count: reports.length,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      data: reports
    });
  } catch (error) {
    console.error('[getAllReports error]:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

/**
 * Retrieve a specific inspection report by ID with ownership verification.
 */
export async function getReportById(req, res) {
  try {
    const reportId = req.params.id;
    if (!reportId || !/^[0-9a-fA-F]{24}$/.test(reportId)) {
      return res.status(400).json({ success: false, error: 'Invalid report ID format' });
    }

    const report = await InspectionReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Role-based authorization: Trainees can only view their own report (IDOR defense)
    if (req.user) {
      const userRole = (req.user.role || '').toLowerCase();
      const isPrivileged = userRole === 'trainer' || userRole === 'admin' || userRole === 'supervisor' || userRole === 'administrator';
      const userIdentifier = req.user.traineeId || req.user.sub;

      if (!isPrivileged && report.traineeId !== userIdentifier) {
        logSecurityEvent({
          action: 'REPORT_ACCESS_DENIED_IDOR',
          outcome: 'FAILURE',
          userId: userIdentifier,
          ip: req.ip,
          details: { reportId, reportOwner: report.traineeId }
        });
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Access denied. You can only view your own reports.'
        });
      }
    }

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('[getReportById error]:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

/**
 * Get aggregated statistics for dashboard/reporting.
 */
export async function getStats(req, res) {
  try {
    const totalReports = await InspectionReport.countDocuments();
    if (totalReports === 0) {
      return res.json({
        success: true,
        stats: {
          totalPatrols: 0,
          passRate: 0,
          averageScore: 0,
          highestScore: 0
        }
      });
    }

    const passedCount = await InspectionReport.countDocuments({ passed: true });
    const scoreStats = await InspectionReport.aggregate([
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$totalScore' },
          maxScore: { $max: '$totalScore' },
          minScore: { $min: '$totalScore' }
        }
      }
    ]);

    const statsData = scoreStats[0] || {};

    return res.json({
      success: true,
      stats: {
        totalPatrols: totalReports,
        passedPatrols: passedCount,
        passRate: Math.round((passedCount / totalReports) * 100),
        averageScore: statsData.avgScore ? Math.round(statsData.avgScore * 10) / 10 : 0,
        highestScore: statsData.maxScore ?? 0,
        lowestScore: statsData.minScore ?? 0
      }
    });
  } catch (error) {
    console.error('[getStats error]:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

/**
 * Top inspection runs leaderboard (anonymized/public metrics).
 */
export async function getLeaderboard(req, res) {
  try {
    const topRuns = await InspectionReport.find()
      .sort({ totalScore: -1, completedAt: -1 })
      .limit(10)
      .select('traineeName totalScore rankTitle passed tierCounts completedAt');

    return res.json({ success: true, data: topRuns });
  } catch (error) {
    console.error('[getLeaderboard error]:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}
