/**
 * indexedDb.js
 * Browser-native IndexedDB persistence engine for Two Pairs of Eyes.
 * 
 * Provides robust, zero-server storage for:
 *  1. Trainee practice profiles (non-sensitive identifiers only; NO PASSWORDS STORED)
 *  2. Inspection debrief reports & scores (with querying and stats)
 *  3. Active session checkpoints (for mid-patrol state resumption)
 * 
 * SECURITY NOTE:
 * In accordance with application security architecture, passwords are NEVER
 * stored or verified in browser storage (localStorage, sessionStorage, or IndexedDB).
 * Offline access provides client-side training and practice gameplay only, without
 * granting privileged server or organization-level reporting access.
 */

const DB_NAME = 'TwoPairsOfEyesDB';
const DB_VERSION = 2; // Incremented for security hardening schema migration

export const STORES = {
  TRAINEES: 'trainees',
  REPORTS: 'inspection_reports',
  SESSIONS: 'active_sessions'
};

// Default trainee profile contains only non-sensitive identifiers (NO PASSWORD)
const DEFAULT_TRAINEE = {
  traineeId: 'TR-10001',
  name: 'Alex (Default Trainee)',
  role: 'TRAINEE',
  department: 'Warehouse Logistics & Health Safety',
  createdAt: '2026-09-01T08:00:00.000Z'
};

/**
 * Opens and initializes the IndexedDB database.
 * Seeds the default trainee account if it doesn't exist yet.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Trainees store (Non-sensitive profile only)
      if (!db.objectStoreNames.contains(STORES.TRAINEES)) {
        const traineeStore = db.createObjectStore(STORES.TRAINEES, { keyPath: 'traineeId' });
        traineeStore.createIndex('name', 'name', { unique: false });
        traineeStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 2. Inspection Reports store
      if (!db.objectStoreNames.contains(STORES.REPORTS)) {
        const reportStore = db.createObjectStore(STORES.REPORTS, { keyPath: 'id', autoIncrement: true });
        reportStore.createIndex('traineeId', 'traineeId', { unique: false });
        reportStore.createIndex('timestamp', 'timestamp', { unique: false });
        reportStore.createIndex('passed', 'passed', { unique: false });
        reportStore.createIndex('totalScore', 'totalScore', { unique: false });
      }

      // 3. Active Sessions store
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        db.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionId' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Seed default trainee if not present
      seedDefaultTrainee(db)
        .then(() => resolve(db))
        .catch(() => resolve(db));
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Seeds default demo trainee into IndexedDB if missing.
 */
function seedDefaultTrainee(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORES.TRAINEES, 'readwrite');
      const store = tx.objectStore(STORES.TRAINEES);
      const getReq = store.get(DEFAULT_TRAINEE.traineeId);

      getReq.onsuccess = () => {
        if (!getReq.result) {
          store.put(DEFAULT_TRAINEE);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Register a new trainee offline in IndexedDB.
 * Passwords are NEVER persisted in browser storage.
 */
export async function registerTraineeOffline({ name, department = 'Warehouse Logistics' }) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TRAINEES, 'readwrite');
      const store = tx.objectStore(STORES.TRAINEES);

      // Generate realistic 5-digit Trainee ID: TR-20000..99999
      const randomSuffix = Math.floor(20000 + Math.random() * 80000);
      const generatedId = `TR-${randomSuffix}`;

      // Strictly exclude any password fields from IndexedDB storage
      const newTrainee = {
        traineeId: generatedId,
        name: name.trim(),
        role: 'TRAINEE',
        department: department.trim(),
        createdAt: new Date().toISOString()
      };

      const addReq = store.add(newTrainee);

      addReq.onsuccess = () => {
        resolve({
          success: true,
          generatedId,
          trainee: {
            traineeId: newTrainee.traineeId,
            name: newTrainee.name,
            role: newTrainee.role,
            department: newTrainee.department
          }
        });
      };

      addReq.onerror = () => {
        resolve({ success: false, error: 'Failed to create trainee record in IndexedDB.' });
      };
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves a trainee profile offline for local practice gameplay.
 * Never stores or checks credentials in browser storage.
 */
export async function loginTraineeOffline({ traineeId }) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TRAINEES, 'readonly');
      const store = tx.objectStore(STORES.TRAINEES);
      const cleanId = (traineeId || '').trim().toUpperCase();
      const req = store.get(cleanId);

      req.onsuccess = () => {
        const trainee = req.result;
        if (!trainee) {
          // Allow default test ID fallback for local offline simulation
          if (/^(TR-10001|TR-DEMO1|demo|alex)$/i.test(traineeId)) {
            return resolve({
              success: true,
              trainee: {
                traineeId: 'TR-10001',
                name: 'Alex (Default Trainee)',
                role: 'TRAINEE',
                department: 'Warehouse Logistics & Health Safety'
              }
            });
          }
          return resolve({ success: false, error: 'Trainee profile not found locally. Server connection required for initial authentication.' });
        }

        resolve({
          success: true,
          trainee: {
            traineeId: trainee.traineeId,
            name: trainee.name,
            role: trainee.role || 'TRAINEE',
            department: trainee.department
          }
        });
      };

      req.onerror = () => {
        resolve({ success: false, error: 'Database read failure.' });
      };
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Persists an inspection debrief report into IndexedDB.
 */
export async function saveInspectionReportOffline(reportPayload) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.REPORTS, 'readwrite');
      const store = tx.objectStore(STORES.REPORTS);

      const record = {
        ...reportPayload,
        timestamp: new Date().toISOString()
      };

      const request = store.add(record);

      request.onsuccess = () => {
        const generatedId = request.result;
        console.log(`[IndexedDB] Inspection report successfully stored under ID #${generatedId}`);
        resolve({
          success: true,
          source: 'indexeddb',
          data: { ...record, id: generatedId }
        });
      };

      request.onerror = () => {
        resolve({ success: false, error: request.error?.message || 'Failed to save report.' });
      };
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves aggregate inspection statistics across all recorded walks.
 */
export async function getInspectionStatsOffline(traineeId = null) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.REPORTS, 'readonly');
      const store = tx.objectStore(STORES.REPORTS);
      const req = store.getAll();

      req.onsuccess = () => {
        let list = req.result || [];
        if (traineeId) {
          list = list.filter((r) => r.traineeId === traineeId);
        }

        const total = list.length;
        const passed = list.filter((r) => r.passed).length;
        const scores = list.map((r) => r.totalScore || 0);
        const avgScore = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : 0;
        const bestScore = total > 0 ? Math.max(...scores) : 0;

        resolve({
          totalWalks: total,
          passedWalks: passed,
          passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
          avgScore: Number(avgScore),
          bestScore,
          latestReport: total > 0 ? list[total - 1] : null
        });
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Saves mid-patrol state checkpoint to allow resumption.
 */
export async function saveActiveSessionOffline(sessionData) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SESSIONS, 'readwrite');
      const store = tx.objectStore(STORES.SESSIONS);
      const payload = {
        sessionId: sessionData.sessionId || 'current_patrol',
        stopIndex: sessionData.stopIndex,
        totalScore: sessionData.totalScore,
        flags: sessionData.flags,
        timestamp: new Date().toISOString()
      };
      store.put(payload);
      resolve({ success: true });
    });
  } catch {
    return { success: false };
  }
}

/**
 * Retrieves the latest active session checkpoint if one exists.
 */
export async function getActiveSessionOffline(sessionId = 'current_patrol') {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SESSIONS, 'readonly');
      const store = tx.objectStore(STORES.SESSIONS);
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
