import express from 'express';
import { User } from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /api/user – current user profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user/profile – update name and/or avatar
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    if (!name && !avatar)
      return res.status(400).json({ error: 'Nothing to update.' });
    if (name && name.trim().length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters.' });

    const updated = await User.update(req.user.id, {
      ...(name   ? { name: name.trim() } : {}),
      ...(avatar ? { avatar }            : {}),
    });

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error('❌ Profile update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
