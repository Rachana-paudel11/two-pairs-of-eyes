import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Scenario, SessionRule } from '../models/Scenario.js';
import { validateStopsData, StopsValidationError } from '../../src/engine/stopsValidator.js';
import { interactionNames } from '../../src/interactions/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STOPS_FILE = path.resolve(__dirname, '../../src/data/stops.json');

/**
 * Loads default fallback scenario data from disk.
 */
function loadDefaultStopsData() {
  try {
    const raw = fs.readFileSync(DEFAULT_STOPS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[ScenarioRepository] Error reading default stops.json:', err.message);
    return { stops: [], endOfSessionRules: [] };
  }
}

// In-memory cache & fallback store (ensures 100% offline & test resilience)
let memoryStore = null;

function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = loadDefaultStopsData();
  }
  return memoryStore;
}

function isDbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Cleans actions map/object from Mongoose or request body into plain object.
 */
function normalizeActions(actions) {
  if (!actions) return {};
  if (actions instanceof Map) {
    return Object.fromEntries(actions);
  }
  if (typeof actions === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(actions)) {
      if (v) {
        clean[k] = {
          interaction: v.interaction,
          points: Number(v.points),
          outcome: v.outcome,
          consequence: v.consequence,
          feedback: v.feedback,
          ...(v.alexAction ? { alexAction: v.alexAction } : {})
        };
      }
    }
    return clean;
  }
  return actions;
}

/**
 * Converts a Mongoose stop document into a clean, schema-compliant stop object.
 */
function normalizeStopDoc(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const actions = normalizeActions(raw.actions);

  const clean = {
    id: raw.id,
    title: raw.title,
    location: raw.location,
    hazard: {
      present: Boolean(raw.hazard?.present),
      ...(raw.hazard?.type ? { type: raw.hazard.type } : {}),
      ...(raw.hazard?.subtype ? { subtype: raw.hazard.subtype } : {}),
      ...(raw.hazard?.severity ? { severity: raw.hazard.severity } : {})
    },
    supervisor: {
      name: raw.supervisor?.name || 'Dave',
      behaviour: raw.supervisor?.behaviour || 'dismissive',
      dialogue: raw.supervisor?.dialogue || ''
    },
    ...(raw.alexStartPosition ? { alexStartPosition: raw.alexStartPosition } : {}),
    ...(raw.alexTargetPosition ? { alexTargetPosition: raw.alexTargetPosition } : {}),
    actions,
    flags_on_failure: Array.isArray(raw.flags_on_failure) ? [...raw.flags_on_failure] : [],
    learning_objective: raw.learning_objective
  };

  return clean;
}

export class ScenarioRepository {
  /**
   * Initializes scenario storage. If MongoDB is connected and collection is empty,
   * seeds the initial dataset from stops.json.
   */
  static async init() {
    if (!isDbReady()) {
      return;
    }
    try {
      const count = await Scenario.countDocuments();
      if (count === 0) {
        const defaultData = loadDefaultStopsData();
        for (let i = 0; i < defaultData.stops.length; i++) {
          const stop = defaultData.stops[i];
          await Scenario.create({
            ...stop,
            order: i + 1,
            isPublished: true
          });
        }
        for (const rule of defaultData.endOfSessionRules || []) {
          await SessionRule.create(rule);
        }
        console.log(`[ScenarioRepository] Seeded ${defaultData.stops.length} default scenarios into MongoDB.`);
      }
    } catch (err) {
      console.info('[ScenarioRepository] MongoDB unavailable or offline; operating in resilient memory mode.');
    }
  }

  /**
   * Retrieves the full scenario bundle { stops: [...], endOfSessionRules: [...] }.
   */
  static async getAll() {
    if (isDbReady()) {
      try {
        const docs = await Scenario.find().sort({ order: 1, createdAt: 1 });
        if (docs && docs.length > 0) {
          const stops = docs.map(normalizeStopDoc);
          const rulesDocs = await SessionRule.find();
          const endOfSessionRules = rulesDocs && rulesDocs.length > 0
            ? rulesDocs.map(r => ({
                id: r.id,
                requiresFlags: [...r.requiresFlags],
                consequence: r.consequence,
                feedback: r.feedback
              }))
            : getMemoryStore().endOfSessionRules || [];

          return { stops, endOfSessionRules };
        }
      } catch {
        // Fallback to memoryStore
      }
    }

    return JSON.parse(JSON.stringify(getMemoryStore()));
  }

  /**
   * Retrieves a single scenario stop by its ID.
   */
  static async getById(id) {
    if (isDbReady()) {
      try {
        const doc = await Scenario.findOne({ id });
        if (doc) return normalizeStopDoc(doc);
      } catch {
        // Fallback to memoryStore
      }
    }

    const mem = getMemoryStore();
    const found = mem.stops.find(s => s.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  /**
   * Validates a candidate dataset or stop change against AJV schema and cross-checks.
   */
  static validate(dataset) {
    try {
      validateStopsData(dataset, { knownInteractionNames: interactionNames });
      return { valid: true, issues: [] };
    } catch (err) {
      if (err instanceof StopsValidationError) {
        return { valid: false, issues: err.issues };
      }
      return { valid: false, issues: [err.message] };
    }
  }

  /**
   * Creates a new scenario stop with full AJV schema and referential integrity validation.
   */
  static async create(stopData) {
    if (!stopData || !stopData.id) {
      throw new Error('Scenario must have a valid id');
    }

    const fullDataset = await this.getAll();

    // Check if ID already exists
    if (fullDataset.stops.some(s => s.id === stopData.id)) {
      throw new Error(`Scenario with id "${stopData.id}" already exists.`);
    }

    // Build candidate dataset and validate via AJV
    const cleanStop = normalizeStopDoc(stopData);
    const candidateDataset = {
      stops: [...fullDataset.stops, cleanStop],
      endOfSessionRules: fullDataset.endOfSessionRules
    };

    const validation = this.validate(candidateDataset);
    if (!validation.valid) {
      const err = new Error(`Scenario validation failed:\n${validation.issues.join('\n')}`);
      err.issues = validation.issues;
      throw err;
    }

    // Persist to MongoDB if available
    if (isDbReady()) {
      try {
        const newOrder = fullDataset.stops.length + 1;
        await Scenario.create({
          ...cleanStop,
          order: newOrder,
          isPublished: true
        });
      } catch (err) {
        if (err.name === 'MongoServerError' || err.code === 11000) {
          throw new Error(`Database error: ${err.message}`);
        }
      }
    }

    // Update in-memory fallback
    const mem = getMemoryStore();
    mem.stops.push(cleanStop);

    return cleanStop;
  }

  /**
   * Updates an existing scenario stop by ID with validation and referential checks.
   */
  static async update(id, stopData) {
    const fullDataset = await this.getAll();
    const existingIndex = fullDataset.stops.findIndex(s => s.id === id);

    if (existingIndex === -1) {
      throw new Error(`Scenario "${id}" not found.`);
    }

    // If ID is being changed, ensure new ID is not already taken
    if (stopData.id && stopData.id !== id) {
      if (fullDataset.stops.some(s => s.id === stopData.id)) {
        throw new Error(`Cannot rename scenario: ID "${stopData.id}" is already in use.`);
      }
    }

    const updatedStop = normalizeStopDoc({
      ...fullDataset.stops[existingIndex],
      ...stopData,
      id: stopData.id || id
    });

    const candidateStops = [...fullDataset.stops];
    candidateStops[existingIndex] = updatedStop;

    const candidateDataset = {
      stops: candidateStops,
      endOfSessionRules: fullDataset.endOfSessionRules
    };

    const validation = this.validate(candidateDataset);
    if (!validation.valid) {
      const err = new Error(`Scenario validation failed:\n${validation.issues.join('\n')}`);
      err.issues = validation.issues;
      throw err;
    }

    // Persist in MongoDB
    if (isDbReady()) {
      try {
        await Scenario.findOneAndUpdate(
          { id },
          { ...updatedStop },
          { new: true }
        );
      } catch (err) {
        if (err.name === 'MongoServerError') {
          throw new Error(`Database error: ${err.message}`);
        }
      }
    }

    // Update in-memory fallback
    const mem = getMemoryStore();
    const memIndex = mem.stops.findIndex(s => s.id === id);
    if (memIndex !== -1) {
      mem.stops[memIndex] = updatedStop;
    }

    return updatedStop;
  }

  /**
   * Deletes a scenario stop safely, verifying referential integrity before allowing deletion.
   */
  static async delete(id) {
    const fullDataset = await this.getAll();
    const stopToDelete = fullDataset.stops.find(s => s.id === id);

    if (!stopToDelete) {
      throw new Error(`Scenario "${id}" not found.`);
    }

    if (fullDataset.stops.length <= 1) {
      throw new Error('Cannot delete scenario: Training simulation requires at least 1 safety stop.');
    }

    const candidateStops = fullDataset.stops.filter(s => s.id !== id);
    const candidateDataset = {
      stops: candidateStops,
      endOfSessionRules: fullDataset.endOfSessionRules
    };

    // Referential Integrity Check:
    // Verify if any end-of-session rules become unreachable
    const validation = this.validate(candidateDataset);
    if (!validation.valid) {
      const err = new Error(
        `Referential integrity violation: Cannot delete scenario "${id}" because deferred end-of-session consequence rules rely on flags it provides:\n${validation.issues.join('\n')}`
      );
      err.issues = validation.issues;
      throw err;
    }

    // Persist in MongoDB
    if (isDbReady()) {
      try {
        await Scenario.deleteOne({ id });
      } catch {
        // Offline fallback
      }
    }

    // Update in-memory fallback
    const mem = getMemoryStore();
    mem.stops = mem.stops.filter(s => s.id !== id);

    return { success: true, deletedId: id };
  }

  /**
   * Resets or publishes changes to the active dataset.
   */
  static async publishAll(dataset) {
    const validation = this.validate(dataset);
    if (!validation.valid) {
      const err = new Error(`Cannot publish invalid scenario data:\n${validation.issues.join('\n')}`);
      err.issues = validation.issues;
      throw err;
    }

    // Update in-memory
    memoryStore = JSON.parse(JSON.stringify(dataset));

    // Update MongoDB if available
    if (isDbReady()) {
      try {
        await Scenario.deleteMany({});
        for (let i = 0; i < dataset.stops.length; i++) {
          await Scenario.create({
            ...dataset.stops[i],
            order: i + 1,
            isPublished: true
          });
        }
        if (dataset.endOfSessionRules) {
          await SessionRule.deleteMany({});
          for (const rule of dataset.endOfSessionRules) {
            await SessionRule.create(rule);
          }
        }
      } catch {
        // Mongo offline
      }
    }

    return memoryStore;
  }
}
