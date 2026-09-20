import express from 'express';
import { Trainee } from '../models/Trainee.js';

const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ success: false, error: 'Name and Password are required.' });
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
      name,
      password
    });
    
    await trainee.save();
    return res.status(201).json({ 
      success: true, 
      trainee, 
      generatedId: traineeId, 
      message: 'New trainee registered successfully.' 
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Server error during registration.' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { traineeId, password } = req.body; // Name is not required for login

    if (!traineeId || !password) {
      return res.status(400).json({ success: false, error: 'Trainee ID and Password are required.' });
    }

    let trainee = await Trainee.findOne({ traineeId });

    if (!trainee) {
      return res.status(404).json({ success: false, error: 'Trainee ID not found. Please register.' });
    }

    // Verify password
    const isMatch = await trainee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid password.' });
    }

    return res.status(200).json({ success: true, trainee, message: 'Login successful.' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error during authentication.' });
  }
});

export default router;
