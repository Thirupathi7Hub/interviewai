import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { generateAptitudeQuestions } from '../services/aiService.js';

const router = express.Router();

// POST /api/aptitude/generate
// Body: { count: 5|10|20, difficulty: 'beginner'|'intermediate'|'expert' }
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { count = 10, difficulty = 'intermediate' } = req.body;

    const validCounts = [5, 10, 20];
    const validDifficulties = ['beginner', 'intermediate', 'expert'];

    if (!validCounts.includes(Number(count)))
      return res.status(400).json({ error: 'count must be 5, 10, or 20' });
    if (!validDifficulties.includes(difficulty))
      return res.status(400).json({ error: 'difficulty must be beginner, intermediate, or expert' });

    const questions = await generateAptitudeQuestions(Number(count), difficulty);
    res.json({ questions, count: questions.length, difficulty });
  } catch (err) {
    console.error('Aptitude generate error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate questions' });
  }
});

export default router;
