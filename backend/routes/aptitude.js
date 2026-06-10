import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { generateAptitudeQuestions } from '../services/aiService.js';
import { Interview } from '../models/Interview.js';

const router = express.Router();

// ─── POST /api/aptitude/generate ──────────────────────────────────────────────
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

// ─── POST /api/aptitude/save ──────────────────────────────────────────────────
// Saves a completed aptitude quiz session to the interviews table.
// Body: { difficulty, count, questions, answers, finalScore, timeTaken }
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { difficulty, count, questions = [], answers = [], finalScore = 0, timeTaken = 0 } = req.body;

    if (!questions.length) return res.status(400).json({ error: 'questions is required' });

    // Build a qa array in the same shape as interview QA
    const qa = questions.map((q, i) => {
      const userAnswer  = answers[i] || null;
      const isCorrect   = userAnswer === q.correct;
      const score       = isCorrect ? 100 : 0;

      // Format the answer as readable text for storage
      const answerText  = userAnswer
        ? `(${userAnswer}) ${q.options?.[userAnswer] || userAnswer}`
        : 'Skipped';

      // Build options as text for PDF display
      const optionsText = q.options
        ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join(' | ')
        : '';

      return {
        question:       q.question,
        answer:         answerText,
        score,
        isCorrect,
        correctOption:  q.correct,
        correctText:    q.options?.[q.correct] || '',
        options:        q.options || {},
        optionsText,
        suggestedAnswer: q.explanation || '',
        // Reuse existing strengths/weaknesses fields for aptitude metadata
        strengths:  isCorrect ? ['Correct answer'] : [],
        weaknesses: !isCorrect ? [`Correct answer: (${q.correct}) ${q.options?.[q.correct] || ''}`] : [],
      };
    });

    const correct  = qa.filter(q => q.isCorrect).length;
    const total    = qa.length;
    const skipped  = answers.filter(a => a === null || a === undefined).length;

    const strengths = [
      `Scored ${correct} / ${total} correct`,
      ...(correct >= total * 0.8 ? ['Excellent aptitude performance'] : []),
      ...(skipped === 0 ? ['Attempted all questions'] : []),
    ];
    const improvements = [
      ...(correct < total * 0.6 ? ['Review core aptitude concepts'] : []),
      ...(skipped > 0 ? [`${skipped} question${skipped > 1 ? 's' : ''} skipped — attempt all next time`] : []),
    ];

    const interview = await Interview.create({
      userId:         req.user.id,
      type:           'Aptitude',
      domain:         `Aptitude Quiz · ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
      totalQuestions: count || total,
      status:         'completed',
      qa,
    });

    // Persist final score, breakdown, strengths and mark completed
    interview.finalScore     = finalScore;
    interview.scoreBreakdown = {
      content:       finalScore,
      communication: finalScore,
      confidence:    finalScore,
    };
    interview.strengths    = strengths.slice(0, 4);
    interview.improvements = improvements.length > 0 ? improvements.slice(0, 4) : ['Keep practising regularly'];
    interview.status       = 'completed';
    interview.completedAt  = new Date();

    await interview.save();

    console.log(`✅ Aptitude quiz saved [id=${interview._id}] score=${finalScore} correct=${correct}/${total}`);

    res.json({
      interviewId:  interview._id,
      finalScore,
      correct,
      total,
      skipped,
      strengths:    interview.strengths,
      improvements: interview.improvements,
      qa:           interview.qa,
      completedAt:  interview.completedAt,
    });
  } catch (err) {
    console.error('Aptitude save error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to save aptitude result' });
  }
});

export default router;
