import { InspectionReport } from '../models/InspectionReport.js';
import { Trainee } from '../models/Trainee.js';

/**
 * Save a new inspection debrief report.
 */
export async function createReport(req, res) {
  try {
    const {
      traineeName = 'Alex',
      traineeId = 'TR-ALEX-01',
      totalScore,
      maxScore = 25,
      passMark = 18,
      passed,
      rankTitle,
      rankSubtitle,
      tierCounts = {},
      zoneLogs = [],
      flags = [],
      triggeredRules = [],
      supervisorReaction
    } = req.body;

    if (totalScore === undefined || totalScore === null) {
      return res.status(400).json({ success: false, error: 'totalScore is required' });
    }

    const calculatedPassed =
      passed !== undefined
        ? Boolean(passed)
        : totalScore >= passMark && (tierCounts.failure || 0) === 0;

    const report = new InspectionReport({
      traineeName,
      traineeId,
      totalScore,
      maxScore,
      passMark,
      passed: calculatedPassed,
      rankTitle: rankTitle || (calculatedPassed ? 'Safety Champion' : 'Hazards Overlooked'),
      rankSubtitle,
      tierCounts,
      zoneLogs,
      flags,
      triggeredRules,
      supervisorReaction,
      completedAt: new Date()
    });

    const savedReport = await report.save();

    // Increment completed patrols for trainee
    await Trainee.findOneAndUpdate(
      { traineeId },
      {
        $setOnInsert: { name: traineeName, role: 'Safety Inspector Trainee' },
        $inc: { patrolsCompleted: 1 }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(201).json({
      success: true,
      message: 'Inspection report saved successfully',
      data: savedReport
    });
  } catch (error) {
    console.error('[createReport error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Retrieve all inspection reports, newest first.
 */
export async function getAllReports(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const reports = await InspectionReport.find()
      .sort({ completedAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('[getAllReports error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Retrieve a specific inspection report by ID.
 */
export async function getReportById(req, res) {
  try {
    const report = await InspectionReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('[getReportById error]:', error);
    return res.status(500).json({ success: false, error: error.message });
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
    console.error('[getStats error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Top inspection runs leaderboard.
 */
export async function getLeaderboard(req, res) {
  try {
    const topRuns = await InspectionReport.find()
      .sort({ totalScore: -1, completedAt: -1 })
      .limit(10)
      .select('traineeName totalScore rankTitle passed tierCounts completedAt');

    return res.json({ success: true, data: topRuns });
  } catch (error) {
    console.error('[getLeaderboard error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
