/**
 * seed.js
 * Creates demo/training accounts in MongoDB.
 * Run manually: npm run seed
 * Refuses to run when NODE_ENV === 'production'.
 */
import dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.error('[Seed] Refusing to seed demo accounts in production.');
  process.exit(1);
}

import mongoose from 'mongoose';
import { Trainee } from './models/Trainee.js';
import { connectDB } from './config/db.js';

const DEMO_ACCOUNTS = [
  {
    traineeId: 'TR-10001',
    name: 'Alex (Default Trainee)',
    password: 'password123',
    role: 'trainee',
    department: 'Warehouse Logistics & Health Safety'
  },
  {
    traineeId: 'TR-DEMO1',
    name: 'Demo Trainer',
    password: 'demo123',
    role: 'trainer',
    department: 'Warehouse Logistics & Health Safety'
  }
];

async function seed() {
  try {
    await connectDB();

    for (const account of DEMO_ACCOUNTS) {
      const existing = await Trainee.findOne({ traineeId: account.traineeId });
      if (existing) {
        console.log(`[Seed] ${account.traineeId} already exists — skipped.`);
        continue;
      }

      const trainee = new Trainee(account);
      await trainee.save();
      console.log(`[Seed] Created ${account.traineeId} (${account.name}) with role "${account.role}".`);
    }

    console.log('[Seed] Done.');
  } catch (err) {
    console.error('[Seed] Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
