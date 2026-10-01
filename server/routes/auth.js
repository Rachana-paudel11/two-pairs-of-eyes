import express from 'express';
import jwt from 'jsonwebtoken';
import { Trainee } from '../models/Trainee.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
const JWT_EXPIRY = '2h';

// Password policy: ≥ 8 chars, ≥ 1 letter, ≥ 1 digit, ≥ 1 symbol
const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
const MAX_IDENTIFIER_LENGTH = 50;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Signs a JWT for the given trainee.
 */
function signToken(trainee) {
  return jwt.sign(
    { sub: trainee.traineeId, role: trainee.role, name: trainee.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// ── Register endpoint ──
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !name.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Player Name and Password are required.' });
    }

    // Enforce password policy on new registrations
    if (!PASSWORD_POLICY.test(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and include a letter, a number, and a symbol (e.g. @#$!%).'
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > MAX_IDENTIFIER_LENGTH) {
      return res.status(400).json({ success: false, error: 'Name is too long (max 50 characters).' });
    }

    // Generate a random unique ID: TR- followed by 5 digits
    let traineeId;
    let isUnique = false;
    while (!isUnique) {
      traineeId = 'TR-' + Math.floor(10000 + Math.random() * 90000);
      const existing = await Trainee.findOne({ traineeId });
      if (!existing) isUnique = true;
    }

    const trainee = new Trainee({
      traineeId,
      name: trimmedName,
      password
    });
    
    await trainee.save();

    const token = signToken(trainee);

    // Strip password hash from response for security
    const traineeSafe = trainee.toObject();
    delete traineeSafe.password;
    delete traineeSafe.failedLoginAttempts;
    delete traineeSafe.lockUntil;

    return res.status(201).json({ 
      success: true, 
      trainee: traineeSafe, 
      token,
      generatedId: traineeId, 
      message: 'New trainee registered successfully.' 
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, error: 'Server error during registration.' });
  }
});

// ── Login endpoint ── supports login via Trainee ID OR Player Name
router.post('/login', async (req, res) => {
  try {
    const { traineeId, password } = req.body;

    if (!traineeId || !traineeId.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Trainee ID (or Name) and Password are required.' });
    }

    const identifier = traineeId.trim();

    // Length limit to prevent abuse
    if (identifier.length > MAX_IDENTIFIER_LENGTH) {
      return res.status(400).json({ success: false, error: 'Identifier is too long (max 50 characters).' });
    }

    // Safe lookup: exact match on traineeId, case-insensitive exact match on name via collation
    // No RegExp — prevents injection
    const trainee = await Trainee.findOne({
      $or: [
        { traineeId: identifier },
        { name: identifier }
      ]
    }).collation({ locale: 'en', strength: 2 });

    if (!trainee) {
      return res.status(404).json({ success: false, error: 'Trainee not found. Check your Trainee ID or register a new account.' });
    }

    // Account lockout check
    if (trainee.lockUntil && trainee.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((trainee.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      });
    }

    // Verify password
    const isMatch = await trainee.comparePassword(password);
    if (!isMatch) {
      // Increment failed attempts
      trainee.failedLoginAttempts = (trainee.failedLoginAttempts || 0) + 1;
      if (trainee.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
        trainee.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await trainee.save();

      return res.status(401).json({ success: false, error: 'Invalid password. Please try again.' });
    }

    // Successful login — reset lockout counters
    if (trainee.failedLoginAttempts > 0 || trainee.lockUntil) {
      trainee.failedLoginAttempts = 0;
      trainee.lockUntil = null;
      await trainee.save();
    }

    const token = signToken(trainee);

    // Strip sensitive fields from response
    const traineeSafe = trainee.toObject();
    delete traineeSafe.password;
    delete traineeSafe.failedLoginAttempts;
    delete traineeSafe.lockUntil;

    return res.status(200).json({ 
      success: true, 
      trainee: traineeSafe, 
      token,
      message: 'Login successful.' 
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, error: 'Server error during authentication.' });
  }
});

export default router;
