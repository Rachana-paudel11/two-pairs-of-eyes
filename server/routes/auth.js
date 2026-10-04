import express from 'express';
import jwt from 'jsonwebtoken';
import { Trainee } from '../models/Trainee.js';
import { validatePassword, escapeRegex } from '../utils/validators.js';
import { logSecurityEvent } from '../utils/logger.js';
import { createRateLimiter } from '../middlewares/rateLimiter.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-prod';
const JWT_EXPIRY = '24h';
const MAX_IDENTIFIER_LENGTH = 50;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Rate limiters for authentication
const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many login attempts. Please wait a minute before trying again.'
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Too many registration attempts. Please wait a minute before trying again.'
});

/**
 * Signs a JWT for the given trainee.
 */
function signToken(trainee) {
  const payload = {
    sub: trainee.traineeId,
    traineeId: trainee.traineeId,
    userId: trainee._id ? trainee._id.toString() : (trainee.userId || trainee.traineeId),
    name: trainee.name,
    role: (trainee.role || 'trainee').toLowerCase(),
    department: trainee.department
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Sets secure authentication cookie on response.
 * @param {express.Response} res
 * @param {string} token
 */
function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    `technova_auth_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${24 * 60 * 60}`
  ];

  if (isProduction) {
    cookieOptions.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, password, department } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Player Name is required.' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > MAX_IDENTIFIER_LENGTH) {
      return res.status(400).json({ success: false, error: 'Name is too long (max 50 characters).' });
    }

    // Server-side password policy enforcement (min 12, max 128)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, error: passwordCheck.error });
    }

    // Generate unique Trainee ID: TR- followed by 5 digits
    let traineeId;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      traineeId = 'TR-' + Math.floor(10000 + Math.random() * 90000);
      const existing = await Trainee.findOne({ traineeId });
      if (!existing) isUnique = true;
      attempts++;
    }

    // Role cannot be overridden by public registration (prevent mass-assignment privilege escalation)
    const trainee = new Trainee({
      traineeId,
      name: trimmedName,
      password,
      role: 'trainee',
      department: (typeof department === 'string' && department.trim()) ? department.trim().slice(0, 100) : 'Warehouse Logistics & Health Safety'
    });

    await trainee.save();

    const token = signToken(trainee);
    setAuthCookie(res, token);
    const traineeSafe = trainee.toJSON();

    logSecurityEvent({
      action: 'AUTH_REGISTER',
      outcome: 'SUCCESS',
      userId: traineeId,
      ip: req.ip,
      details: { name: trimmedName }
    });

    return res.status(201).json({
      success: true,
      trainee: traineeSafe,
      token,
      generatedId: traineeId,
      message: 'New trainee registered successfully.'
    });
  } catch (err) {
    console.error('[Register error]:', err.message);
    logSecurityEvent({
      action: 'AUTH_REGISTER',
      outcome: 'FAILURE',
      ip: req.ip,
      details: { error: 'Registration error' }
    });
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { traineeId, password } = req.body || {};

    if (!traineeId || typeof traineeId !== 'string' || !traineeId.trim() || !password) {
      return res.status(400).json({
        success: false,
        error: 'Trainee ID (or Name) and Password are required.'
      });
    }

    const identifier = traineeId.trim();

    if (identifier.length > MAX_IDENTIFIER_LENGTH) {
      return res.status(400).json({
        success: false,
        error: 'Identifier is too long (max 50 characters).'
      });
    }

    // Check environment-gated demo login (default: disabled)
    const isDemoEnabled = process.env.ENABLE_DEMO_LOGIN === 'true';
    const isDefaultId = /^(TR-10001|TR-DEMO1|demo|alex)$/i.test(identifier);
    const isDefaultPass = password === 'password123' || password === 'demo123';

    if (isDemoEnabled && isDefaultId && isDefaultPass) {
      const demoUser = {
        userId: 'demo_user_001',
        traineeId: 'TR-10001',
        name: 'Alex (Default Trainee)',
        role: 'trainee',
        department: 'Warehouse Logistics & Health Safety'
      };

      const token = signToken(demoUser);
      setAuthCookie(res, token);

      logSecurityEvent({
        action: 'AUTH_LOGIN_DEMO',
        outcome: 'SUCCESS',
        userId: demoUser.traineeId,
        ip: req.ip,
        details: { mode: 'DEMO_CREDENTIALS_ENABLED' }
      });

      return res.status(200).json({
        success: true,
        token,
        trainee: demoUser,
        message: 'Login successful (development demo mode).'
      });
    }

    // Safe sanitized search against Trainee ID or Name (escapes regex metacharacters)
    const safeIdentifier = escapeRegex(identifier);
    const trainee = await Trainee.findOne({
      $or: [
        { traineeId: identifier.toUpperCase() },
        { name: new RegExp(`^${safeIdentifier}$`, 'i') }
      ]
    });

    // Generic error message to prevent user enumeration
    const genericAuthError = 'Invalid credentials. Please verify your Trainee ID and password.';

    if (!trainee) {
      logSecurityEvent({
        action: 'AUTH_LOGIN',
        outcome: 'FAILURE',
        userId: identifier,
        ip: req.ip,
        details: { reason: 'User not found' }
      });
      return res.status(401).json({ success: false, error: genericAuthError });
    }

    // Account lockout check
    if (trainee.lockUntil && trainee.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((trainee.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`
      });
    }

    // Verify password via bcrypt
    const isMatch = await trainee.comparePassword(password);
    if (!isMatch) {
      trainee.failedLoginAttempts = (trainee.failedLoginAttempts || 0) + 1;
      if (trainee.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
        trainee.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await trainee.save();

      logSecurityEvent({
        action: 'AUTH_LOGIN',
        outcome: 'FAILURE',
        userId: trainee.traineeId,
        ip: req.ip,
        details: { reason: 'Password mismatch', attempts: trainee.failedLoginAttempts }
      });
      return res.status(401).json({ success: false, error: genericAuthError });
    }

    // Successful login: reset lockout counters
    if (trainee.failedLoginAttempts > 0 || trainee.lockUntil) {
      trainee.failedLoginAttempts = 0;
      trainee.lockUntil = null;
      await trainee.save();
    }

    const token = signToken(trainee);
    setAuthCookie(res, token);

    const traineeSafe = trainee.toJSON();

    logSecurityEvent({
      action: 'AUTH_LOGIN',
      outcome: 'SUCCESS',
      userId: trainee.traineeId,
      ip: req.ip,
      details: { role: trainee.role }
    });

    return res.status(200).json({
      success: true,
      token,
      trainee: traineeSafe,
      message: 'Login successful.'
    });
  } catch (err) {
    console.error('[Login error]:', err.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/auth/me - Verifies current authenticated session
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

export default router;
