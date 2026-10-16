import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admin } from '../models/Admin.js';
import {
  createAdminSession,
  destroyAdminSession,
  requireAdminAuth
} from '../middlewares/adminAuth.js';

const router = express.Router();

const DEFAULT_ADMIN_USER = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'adminPassword123!';

/**
 * Helper to ensure a default system admin account exists in MongoDB when connected.
 */
export async function ensureDefaultAdmin() {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    console.warn('[Admin Security] Default admin seed skipped in production because ADMIN_PASSWORD is not configured in environment.');
    return;
  }
  try {
    const existing = await Admin.findOne({ username: DEFAULT_ADMIN_USER });
    if (!existing) {
      const admin = new Admin({
        username: DEFAULT_ADMIN_USER,
        password: DEFAULT_ADMIN_PASS,
        name: 'System Administrator',
        role: 'System Administrator'
      });
      await admin.save();
      console.log(`[Admin] Initialized default admin account: ${DEFAULT_ADMIN_USER}`);
    }
  } catch (err) {
    // If DB is offline or table not ready, log warning but don't crash
    console.warn('[Admin] Default admin seed skipped or DB unavailable:', err.message);
  }
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !username.trim() || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.'
      });
    }

    const cleanUser = username.trim().toLowerCase();

    // 1. Check MongoDB for registered admin
    let admin = null;
    let isMatch = false;

    try {
      admin = await Admin.findOne({ username: cleanUser });
      if (admin) {
        isMatch = await admin.comparePassword(password);
      }
    } catch {
      // MongoDB might be unavailable
    }

    // 2. Fallback check against configured environment / default admin credentials
    if (!admin && cleanUser === DEFAULT_ADMIN_USER) {
      if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
        return res.status(401).json({
          success: false,
          error: 'Default admin credentials disabled in production without configured ADMIN_PASSWORD.'
        });
      }

      if (password === DEFAULT_ADMIN_PASS) {
        isMatch = true;
        admin = {
          _id: 'default_admin_id',
          username: DEFAULT_ADMIN_USER,
          name: 'System Administrator',
          role: 'System Administrator'
        };
        // Best effort create in DB in background
        ensureDefaultAdmin().catch(() => {});
      }
    }

    if (!admin || !isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid administrator credentials.'
      });
    }

    // Update lastLogin if Mongoose document
    if (admin.save && typeof admin.save === 'function') {
      admin.lastLogin = new Date();
      admin.save().catch(() => {});
    }

    const { token, session } = createAdminSession(admin);

    return res.status(200).json({
      success: true,
      token,
      admin: {
        id: session.adminId,
        username: session.username,
        name: session.name,
        role: session.role
      },
      message: 'Admin authentication successful.'
    });
  } catch (err) {
    console.error('[Admin Login Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error during admin authentication.'
    });
  }
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  let token = null;
  if (authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
  }

  if (token) {
    destroyAdminSession(token);
  }

  return res.status(200).json({
    success: true,
    message: 'Admin logged out successfully.'
  });
});

// GET /api/admin/me
router.get('/me', requireAdminAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    admin: req.admin
  });
});

export default router;
