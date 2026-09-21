import express from 'express';
import { Trainee } from '../models/Trainee.js';

const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !name.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Player Name and Password are required.' });
    }

    const trimmedName = name.trim();

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

    // Strip password hash from response for security
    const traineeSafe = trainee.toObject();
    delete traineeSafe.password;

    return res.status(201).json({ 
      success: true, 
      trainee: traineeSafe, 
      generatedId: traineeId, 
      message: 'New trainee registered successfully.' 
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Server error during registration.' });
  }
});

// Login endpoint - supports login via Trainee ID OR Player Name
router.post('/login', async (req, res) => {
  try {
    const { traineeId, password } = req.body;

    if (!traineeId || !traineeId.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Trainee ID (or Name) and Password are required.' });
    }

    const identifier = traineeId.trim();

    // Query by either official Trainee ID (e.g. TR-12345) or registered Name (case-insensitive)
    let trainee = await Trainee.findOne({
      $or: [
        { traineeId: identifier },
        { name: new RegExp(`^${identifier}$`, 'i') }
      ]
    });

    if (!trainee) {
      return res.status(404).json({ success: false, error: 'Trainee not found. Check your Trainee ID or register a new account.' });
    }

    // Verify password
    const isMatch = await trainee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid password. Please try again.' });
    }

    // Strip password hash from response for security
    const traineeSafe = trainee.toObject();
    delete traineeSafe.password;

    return res.status(200).json({ 
      success: true, 
      trainee: traineeSafe, 
      message: 'Login successful.' 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during authentication.' });
  }
});

export default router;
