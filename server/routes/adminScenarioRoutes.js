import express from 'express';
import { ScenarioRepository } from '../repositories/ScenarioRepository.js';
import { requireAdminAuth } from '../middlewares/adminAuth.js';

const router = express.Router();

/**
 * Public endpoint for simulation scenario loader.
 * Trainee client fetches currently published scenario data here.
 */
router.get('/public', async (req, res) => {
  try {
    const data = await ScenarioRepository.getAll();
    return res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('[Public Scenarios Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve scenarios'
    });
  }
});

// All following routes in this router require administrative authentication
router.use(requireAdminAuth);

/**
 * GET /api/admin/scenarios
 * Returns all scenarios and end-of-session consequence rules.
 */
router.get('/', async (req, res) => {
  try {
    const dataset = await ScenarioRepository.getAll();
    return res.json({
      success: true,
      count: dataset.stops.length,
      data: dataset
    });
  } catch (err) {
    console.error('[Admin GET Scenarios Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error retrieving scenarios'
    });
  }
});

/**
 * GET /api/admin/scenarios/:id
 * Retrieves one scenario stop.
 */
router.get('/:id', async (req, res) => {
  try {
    const stop = await ScenarioRepository.getById(req.params.id);
    if (!stop) {
      return res.status(404).json({
        success: false,
        error: `Scenario stop "${req.params.id}" not found.`
      });
    }
    return res.json({
      success: true,
      data: stop
    });
  } catch (err) {
    console.error('[Admin GET Scenario ID Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error retrieving scenario'
    });
  }
});

/**
 * POST /api/admin/scenarios/validate
 * Validates a candidate scenario stop without persisting it.
 */
router.post('/validate', async (req, res) => {
  try {
    const candidateStop = req.body;
    const fullDataset = await ScenarioRepository.getAll();

    // Check candidate in context
    const existingIndex = fullDataset.stops.findIndex(s => s.id === candidateStop.id);
    const candidateStops = [...fullDataset.stops];

    if (existingIndex >= 0) {
      candidateStops[existingIndex] = candidateStop;
    } else {
      candidateStops.push(candidateStop);
    }

    const testDataset = {
      stops: candidateStops,
      endOfSessionRules: fullDataset.endOfSessionRules
    };

    const result = ScenarioRepository.validate(testDataset);
    return res.json({
      success: result.valid,
      valid: result.valid,
      issues: result.issues
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      valid: false,
      issues: [err.message]
    });
  }
});

/**
 * POST /api/admin/scenarios/:id/validate
 * Validates changes to an existing scenario stop.
 */
router.post('/:id/validate', async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const fullDataset = await ScenarioRepository.getAll();

    const existingIndex = fullDataset.stops.findIndex(s => s.id === id);
    if (existingIndex === -1) {
      return res.status(404).json({
        success: false,
        valid: false,
        issues: [`Scenario "${id}" not found.`]
      });
    }

    const candidateStops = [...fullDataset.stops];
    candidateStops[existingIndex] = { ...candidateStops[existingIndex], ...updateData, id };

    const testDataset = {
      stops: candidateStops,
      endOfSessionRules: fullDataset.endOfSessionRules
    };

    const result = ScenarioRepository.validate(testDataset);
    return res.json({
      success: result.valid,
      valid: result.valid,
      issues: result.issues
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      valid: false,
      issues: [err.message]
    });
  }
});

/**
 * POST /api/admin/scenarios
 * Adds a new scenario stop.
 */
router.post('/', async (req, res) => {
  try {
    const created = await ScenarioRepository.create(req.body);
    return res.status(201).json({
      success: true,
      message: `Scenario "${created.id}" created successfully.`,
      data: created
    });
  } catch (err) {
    console.error('[Admin Create Scenario Error]:', err);
    return res.status(400).json({
      success: false,
      error: err.message,
      issues: err.issues || []
    });
  }
});

/**
 * PUT /api/admin/scenarios/:id
 * Updates an existing scenario stop.
 */
router.put('/:id', async (req, res) => {
  try {
    const updated = await ScenarioRepository.update(req.params.id, req.body);
    return res.json({
      success: true,
      message: `Scenario "${updated.id}" updated successfully.`,
      data: updated
    });
  } catch (err) {
    console.error('[Admin Update Scenario Error]:', err);
    return res.status(400).json({
      success: false,
      error: err.message,
      issues: err.issues || []
    });
  }
});

/**
 * DELETE /api/admin/scenarios/:id
 * Deletes a scenario stop safely after referential integrity verification.
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await ScenarioRepository.delete(req.params.id);
    return res.json({
      success: true,
      message: `Scenario "${req.params.id}" deleted successfully.`,
      deletedId: result.deletedId
    });
  } catch (err) {
    console.error('[Admin Delete Scenario Error]:', err);
    return res.status(400).json({
      success: false,
      error: err.message,
      issues: err.issues || []
    });
  }
});

/**
 * POST /api/admin/scenarios/publish
 * Publishes and persists the current full dataset.
 */
router.post('/publish', async (req, res) => {
  try {
    const dataset = req.body?.stops ? req.body : await ScenarioRepository.getAll();
    const published = await ScenarioRepository.publishAll(dataset);
    return res.json({
      success: true,
      message: 'All scenarios successfully published and synchronized with simulation.',
      data: published
    });
  } catch (err) {
    console.error('[Admin Publish Error]:', err);
    return res.status(400).json({
      success: false,
      error: err.message,
      issues: err.issues || []
    });
  }
});

export default router;
