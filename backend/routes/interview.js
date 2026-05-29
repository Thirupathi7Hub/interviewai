import express from 'express';
import Interview from '../models/Interview.js';
import authMiddleware from '../middleware/auth.js';
import { generateQuestion, evaluateAnswer } from '../services/aiService.js';

const router = express.Router();

// ─── POST /api/interview/start ────────────────────────────────────────────────
// Create a new interview session and get the first question
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { type, domain, totalQuestions: tq, difficulty = 'intermediate' } = req.body;
    if (!type || !domain) return res.status(400).json({ error: 'type and domain are required' });
    const totalQuestions = [5, 10, 20].includes(Number(tq)) ? Number(tq) : 5;

    const { question } = await generateQuestion(type, domain, 0, [], false, difficulty);

    const interview = await Interview.create({
      userId: req.user.id,
      type,
      domain,
      totalQuestions,
      status: 'active',
      qa: [{ question, answer: '', score: 0, _difficulty: difficulty }],  // ← store difficulty
    });

    res.status(201).json({
      interviewId: interview._id,
      question,
      questionIndex: 0,
      totalQuestions,
      difficulty,
    });
  } catch (err) {
    console.error('Start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/interview/answer ───────────────────────────────────────────────
// Submit an answer, get AI evaluation + next question (or final results)
router.post('/answer', authMiddleware, async (req, res) => {
  try {
    const { interviewId, answer, questionIndex } = req.body;
    if (!interviewId || answer === undefined || questionIndex === undefined) {
      return res.status(400).json({ error: 'interviewId, answer, questionIndex are required' });
    }

    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (interview.status === 'completed') return res.status(400).json({ error: 'Interview already completed' });

    const currentQA = interview.qa[questionIndex];
    if (!currentQA) return res.status(400).json({ error: 'Invalid question index' });

    const difficulty     = interview.qa[0]?._difficulty || 'intermediate';
    const nextIndex      = questionIndex + 1;
    const TOTAL_QUESTIONS = interview.totalQuestions || 5;
    const isLast         = nextIndex >= TOTAL_QUESTIONS;

    // ── PARALLEL: evaluate answer + pre-generate next question simultaneously ──
    const [evaluation, preGenResult] = await Promise.all([
      // Key-2 (or key-1 fallback): evaluate the answer
      evaluateAnswer(currentQA.question, answer, interview.type, interview.domain, questionIndex),

      // Key-1: pre-generate next question in parallel (assume no follow-up yet)
      !isLast
        ? generateQuestion(interview.type, interview.domain, nextIndex, interview.qa, false, difficulty)
        : Promise.resolve(null),
    ]);

    // Update current Q&A with evaluation results
    interview.qa[questionIndex].answer          = answer;
    interview.qa[questionIndex].score           = evaluation.score;
    interview.qa[questionIndex].strengths       = evaluation.strengths;
    interview.qa[questionIndex].weaknesses      = evaluation.weaknesses;
    interview.qa[questionIndex].suggestedAnswer = evaluation.suggestedAnswer;

    // Decide: use pre-generated question or fetch a follow-up?
    let isFollowUp   = false;
    let nextQuestion = preGenResult?.question;

    if (!isLast && evaluation.score < 60 && !currentQA.isFollowUp) {
      // Score too low → discard pre-generated, get a contextual follow-up
      isFollowUp = true;
      console.log('🔄 Low score — generating follow-up question...');
      const { question: fuQ } = await generateQuestion(
        interview.type, interview.domain, nextIndex, interview.qa, true, difficulty
      );
      nextQuestion = fuQ;
    }

    if (isLast) {
      // Calculate final score
      const scores = interview.qa.map(q => q.score || 0);
      const finalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      // Aggregate strengths / improvements
      const allStrengths   = interview.qa.flatMap(q => q.strengths   || []);
      const allWeaknesses  = interview.qa.flatMap(q => q.weaknesses  || []);

      interview.finalScore = finalScore;
      interview.scoreBreakdown = evaluation.breakdown;
      interview.strengths    = [...new Set(allStrengths)].slice(0, 4);
      interview.improvements = [...new Set(allWeaknesses)].slice(0, 4);
      interview.status       = 'completed';
      interview.completedAt  = new Date();

      await interview.save();

      return res.json({
        evaluation,
        isComplete: true,
        results: {
          interviewId: interview._id,
          finalScore,
          scoreBreakdown: interview.scoreBreakdown,
          strengths:    interview.strengths,
          improvements: interview.improvements,
          qa: interview.qa,
          type: interview.type,
          domain: interview.domain,
          completedAt: interview.completedAt,
        },
      });
    }

    // Append next question slot (nextQuestion already resolved by Promise.all above)
    interview.qa.push({ question: nextQuestion, answer: '', score: 0, isFollowUp });
    await interview.save();

    res.json({
      evaluation,
      isComplete: false,
      nextQuestion,
      nextIndex,
      totalQuestions: TOTAL_QUESTIONS,
      progress: { current: nextIndex + 1, total: TOTAL_QUESTIONS },
    });
  } catch (err) {
    console.error('Answer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/interview/end ──────────────────────────────────────────────────
// End an interview early and calculate results
router.post('/end', authMiddleware, async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (interview.status === 'completed') return res.status(400).json({ error: 'Already completed' });

    // Calculate score for answered questions only
    const answeredQA = interview.qa.filter(q => q.answer && q.answer.trim().length > 0);
    const scores = answeredQA.map(q => q.score || 0);
    const finalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const allStrengths   = answeredQA.flatMap(q => q.strengths   || []);
    const allWeaknesses  = answeredQA.flatMap(q => q.weaknesses  || []);

    // Set fallback breakdown if empty
    interview.finalScore = finalScore;
    interview.scoreBreakdown = interview.scoreBreakdown || { content: finalScore, communication: finalScore, confidence: finalScore };
    interview.strengths    = [...new Set(allStrengths)].slice(0, 4);
    if (interview.strengths.length === 0) interview.strengths = ["Completed interview early"];
    interview.improvements = [...new Set(allWeaknesses)].slice(0, 4);
    if (interview.improvements.length === 0) interview.improvements = ["Answer more questions to get detailed feedback"];
    
    interview.status       = 'completed';
    interview.completedAt  = new Date();

    await interview.save();

    res.json({
      isComplete: true,
      results: {
        interviewId: interview._id,
        finalScore,
        scoreBreakdown: interview.scoreBreakdown,
        strengths:    interview.strengths,
        improvements: interview.improvements,
        qa: interview.qa,
        type: interview.type,
        domain: interview.domain,
        completedAt: interview.completedAt,
      },
    });
  } catch (err) {
    console.error('End early error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/interview/history ───────────────────────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const [interviews, total] = await Promise.all([
      Interview.find(
        { userId: req.user.id, status: 'completed' },
        { sort: { completedAt: -1 }, skip, limit }
      ),
      Interview.countDocuments({ userId: req.user.id, status: 'completed' }),
    ]);

    const allScores = interviews.map(i => i.finalScore);
    const avgScore  = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
    const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;

    res.json({
      interviews,
      stats:      { total, avgScore, bestScore },
      pagination: { page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/interview/:id ────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, userId: req.user.id });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
