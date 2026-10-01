/**
 * indexedDb.js
 * Browser-native IndexedDB persistence engine for Two Pairs of Eyes.
 * 
 * Provides robust, zero-server storage for:
 *  1. Trainee accounts (registration & authentication) — passwords hashed with PBKDF2
 *  2. Inspection debrief reports & scores (with querying and stats)
 *  3. Active session checkpoints (for mid-patrol state resumption)
 */

const DB_NAME = 'TwoPairsOfEyesDB';
const DB_VERSION = 1;

export const STORES = {
  TRAINEES: 'trainees',
  REPORTS: 'inspection_reports',
  SESSIONS: 'active_sessions'
};

// ── PBKDF2 Hashing Utilities (Web Crypto API) ──

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_ALGO = 'SHA-256';

/**
 * Generates a random 16-byte salt as a hex string.
 */
function generateSalt() {
  const buf = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return bufToHex(buf);
}

/**
 * Converts a Uint8Array to a hex string.
 */
function bufToHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts a hex string to a Uint8Array.
 */
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives a PBKDF2 hash from a password and salt.
 * @param {string} password  Plain-text password
 * @param {string} saltHex   Salt as hex string
 * @returns {Promise<string>} Hash as hex string
 */
export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBuf(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGO
    },
    keyMaterial,
    256 // 32 bytes
  );
  return bufToHex(new Uint8Array(bits));
}

/**
 * Verifies a password against a stored salt+hash using constant-time comparison.
 * @param {string} password  Candidate password
 * @param {string} saltHex   Stored salt (hex)
 * @param {string} storedHashHex  Stored hash (hex)
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, saltHex, storedHashHex) {
  const candidateHash = await hashPassword(password, saltHex);
  // Constant-time comparison (no short-circuit)
  const a = hexToBuf(candidateHash);
  const b = hexToBuf(storedHashHex);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// Pre-computed hash for the default trainee (password: "password123")
// Generated with salt below and PBKDF2_ITERATIONS iterations.
// We compute it lazily on first DB open so the code stays portable.
let _defaultTraineePromise = null;

async function getDefaultTrainee() {
  if (!_defaultTraineePromise) {
    _defaultTraineePromise = (async () => {
      // Use a fixed salt for the seed account so it's deterministic per install
      const salt = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8'; // 16 bytes hex
      const hash = await hashPassword('password123', salt);
      return {
        traineeId: 'TR-10001',
        name: 'Alex (Default Trainee)',
        salt,
        hash,
        role: 'Safety Inspector Trainee',
        department: 'Warehouse Logistics & Health Safety',
        createdAt: '2026-09-01T08:00:00.000Z'
      };
    })();
  }
  return _defaultTraineePromise;
}

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

      // 1. Trainees store
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
async function seedDefaultTrainee(db) {
  try {
    const defaultTrainee = await getDefaultTrainee();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TRAINEES, 'readwrite');
      const store = tx.objectStore(STORES.TRAINEES);
      const getReq = store.get(defaultTrainee.traineeId);

      getReq.onsuccess = () => {
        if (!getReq.result) {
          store.put(defaultTrainee);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    });
  } catch {
    // crypto.subtle not available (Node test env) — skip
  }
}

/**
 * Migrates a legacy plain-text password record to PBKDF2.
 * Called on successful login when record still has a plain `password` field.
 */
async function migratePlainTextPassword(db, trainee, plainPassword) {
  try {
    const salt = generateSalt();
    const hash = await hashPassword(plainPassword, salt);
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TRAINEES, 'readwrite');
      const store = tx.objectStore(STORES.TRAINEES);
      const updated = { ...trainee, salt, hash };
      delete updated.password; // remove plain-text field
      store.put(updated);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => resolve(trainee);
    });
  } catch {
    return trainee;
  }
}

/**
 * Register a new trainee offline in IndexedDB.
 */
export async function registerTraineeOffline({ name, password, department = 'Warehouse Logistics' }) {
  try {
    const db = await openDatabase();

    // Hash the password with PBKDF2
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);

    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TRAINEES, 'readwrite');
      const store = tx.objectStore(STORES.TRAINEES);

      // Generate realistic 5-digit Trainee ID: TR-20000..99999
      const randomSuffix = Math.floor(20000 + Math.random() * 80000);
      const generatedId = `TR-${randomSuffix}`;

      const newTrainee = {
        traineeId: generatedId,
        name: name.trim(),
        salt,
        hash,
        role: 'Safety Inspector Trainee',
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
 * Authenticate a trainee offline against IndexedDB.
 * Supports PBKDF2-hashed records and migrates legacy plain-text records.
 */
export async function loginTraineeOffline({ traineeId, password }) {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TRAINEES, 'readonly');
      const store = tx.objectStore(STORES.TRAINEES);
      const req = store.get(traineeId.trim().toUpperCase());

      req.onsuccess = async () => {
        let trainee = req.result;
        if (!trainee) {
          return resolve({ success: false, error: 'Invalid Trainee ID. Account not found.' });
        }

        let isValid = false;

        if (trainee.salt && trainee.hash) {
          // Modern hashed record — verify with PBKDF2
          isValid = await verifyPassword(password, trainee.salt, trainee.hash);
        } else if (trainee.password !== undefined) {
          // Legacy plain-text record — compare directly, then migrate
          isValid = (trainee.password === password);
          if (isValid) {
            // Migrate to hashed format
            trainee = await migratePlainTextPassword(db, trainee, password);
          }
        }

        if (!isValid) {
          return resolve({ success: false, error: 'Incorrect password. Please verify credentials.' });
        }

        resolve({
          success: true,
          trainee: {
            traineeId: trainee.traineeId,
            name: trainee.name,
            role: trainee.role,
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
