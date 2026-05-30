import express from 'express';
import Interview from '../models/Interview.js';
import authMiddleware from '../middleware/auth.js';
import { generateQuestion, evaluateAnswer } from '../services/aiService.js';

const router = express.Router();

// ─── POST /api/interview/start ────────────────────────────────────────────────
// ⚡ Pre-generates first 3 questions at once — Q2 & Q3 are instant (no wait)
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { type, domain, totalQuestions: tq, difficulty = 'intermediate' } = req.body;
    if (!type || !domain) return res.status(400).json({ error: 'type and domain are required' });
    const totalQuestions = [5, 10, 20].includes(Number(tq)) ? Number(tq) : 5;

    // Generate first 3 questions in parallel — eliminates wait for Q1, Q2, Q3
    const PREFETCH = Math.min(3, totalQuestions);
    const prefetchResults = await Promise.all(
      Array.from({ length: PREFETCH }, (_, i) =>
        generateQuestion(type, domain, i, [], false, difficulty)
      )
    );

    // Build qa array: Q1 shown immediately, Q2/Q3 pre-queued silently
    const qa = prefetchResults.map(({ question }, i) => ({
      question,
      answer:      '',
      score:       0,
      _difficulty: i === 0 ? difficulty : undefined, // store difficulty on first entry only
      _prefetched: i > 0,                            // mark as pre-fetched (not yet answered)
    }));

    const interview = await Interview.create({
      userId: req.user.id,
      type,
      domain,
      totalQuestions,
      status: 'active',
      qa,
    });

    res.status(201).json({
      interviewId:   interview._id,
      question:      qa[0].question,
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
// Strategy:
//   - If next Q is pre-fetched → only evaluate (instant next question)
//   - If buffer exhausted → evaluate + generate in parallel (~50% faster)
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

    const TOTAL_QUESTIONS = interview.totalQuestions || 5;
    const nextIndex       = questionIndex + 1;
    const isLast          = nextIndex >= TOTAL_QUESTIONS;
    const difficulty      = interview.qa[0]?._difficulty || 'intermediate';

    let evaluation, nextQuestion, isFollowUp = false;

    if (isLast) {
      // Final question — only need evaluation
      evaluation = await evaluateAnswer(
        currentQA.question, answer, interview.type, interview.domain, questionIndex
      );
    } else {
      const prefetchedNext = interview.qa[nextIndex];
      const isPreFetched   = prefetchedNext?._prefetched && !prefetchedNext.answer;

      if (isPreFetched) {
        // ⚡ Q is already ready — only call evaluateAnswer (no question generation!)
        evaluation   = await evaluateAnswer(
          currentQA.question, answer, interview.type, interview.domain, questionIndex
        );
        nextQuestion = prefetchedNext.question;
        interview.qa[nextIndex]._prefetched = false;

        // If weak answer, swap pre-fetched Q with a follow-up
        if (evaluation.score < 60 && !currentQA.isFollowUp) {
          isFollowUp = true;
          const followUp = await generateQuestion(
            interview.type, interview.domain, nextIndex, interview.qa, true, difficulty
          );
          nextQuestion                          = followUp.question;
          interview.qa[nextIndex].question      = nextQuestion;
          interview.qa[nextIndex].isFollowUp    = true;
        }
      } else {
        // Buffer exhausted — run evaluation + generation in parallel
        const [evalResult, questionResult] = await Promise.all([
          evaluateAnswer(currentQA.question, answer, interview.type, interview.domain, questionIndex),
          generateQuestion(interview.type, interview.domain, nextIndex, interview.qa, false, difficulty),
        ]);
        evaluation = evalResult;

        if (evaluation.score < 60 && !currentQA.isFollowUp) {
          isFollowUp = true;
          const followUp = await generateQuestion(
            interview.type, interview.domain, nextIndex, interview.qa, true, difficulty
          );
          nextQuestion = followUp.question;
        } else {
          nextQuestion = questionResult.question;
        }
      }
    }

    // Save evaluation results to current Q&A slot
    interview.qa[questionIndex].answer          = answer;
    interview.qa[questionIndex].score           = evaluation.score;
    interview.qa[questionIndex].strengths       = evaluation.strengths;
    interview.qa[questionIndex].weaknesses      = evaluation.weaknesses;
    interview.qa[questionIndex].suggestedAnswer = evaluation.suggestedAnswer;

    if (!isLast) {
      // Ensure the next slot exists in qa array
      if (!interview.qa[nextIndex]) {
        interview.qa.push({ question: nextQuestion, answer: '', score: 0, isFollowUp });
      }
      await interview.save();

      return res.json({
        evaluation,
        isComplete:     false,
        nextQuestion,
        nextIndex,
        totalQuestions: TOTAL_QUESTIONS,
        progress:       { current: nextIndex + 1, total: TOTAL_QUESTIONS },
      });
    }

    // isLast — compute final results
    const scores        = interview.qa.map(q => q.score || 0);
    const finalScore    = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const allStrengths  = interview.qa.flatMap(q => q.strengths  || []);
    const allWeaknesses = interview.qa.flatMap(q => q.weaknesses || []);

    interview.finalScore     = finalScore;
    interview.scoreBreakdown = evaluation.breakdown;
    interview.strengths      = [...new Set(allStrengths)].slice(0, 4);
    interview.improvements   = [...new Set(allWeaknesses)].slice(0, 4);
    interview.status         = 'completed';
    interview.completedAt    = new Date();

    await interview.save();

    return res.json({
      evaluation,
      isComplete: true,
      results: {
        interviewId:    interview._id,
        finalScore,
        scoreBreakdown: interview.scoreBreakdown,
        strengths:      interview.strengths,
        improvements:   interview.improvements,
        qa:             interview.qa,
        type:           interview.type,
        domain:         interview.domain,
        completedAt:    interview.completedAt,
      },
    });
  } catch (err) {
    console.error('Answer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/interview/end ──────────────────────────────────────────────────
router.post('/end', authMiddleware, async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findOne({ _id: interviewId, userId: req.user.id });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (interview.status === 'completed') return res.status(400).json({ error: 'Already completed' });

    const answeredQA    = interview.qa.filter(q => q.answer && q.answer.trim().length > 0);
    const scores        = answeredQA.map(q => q.score || 0);
    const finalScore    = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const allStrengths  = answeredQA.flatMap(q => q.strengths  || []);
    const allWeaknesses = answeredQA.flatMap(q => q.weaknesses || []);

    interview.finalScore     = finalScore;
    interview.scoreBreakdown = interview.scoreBreakdown || { content: finalScore, communication: finalScore, confidence: finalScore };
    interview.strengths      = [...new Set(allStrengths)].slice(0, 4);
    if (interview.strengths.length === 0) interview.strengths = ['Completed interview early'];
    interview.improvements   = [...new Set(allWeaknesses)].slice(0, 4);
    if (interview.improvements.length === 0) interview.improvements = ['Answer more questions to get detailed feedback'];
    interview.status         = 'completed';
    interview.completedAt    = new Date();

    await interview.save();

    res.json({
      isComplete: true,
      results: {
        interviewId:    interview._id,
        finalScore,
        scoreBreakdown: interview.scoreBreakdown,
        strengths:      interview.strengths,
        improvements:   interview.improvements,
        qa:             interview.qa,
        type:           interview.type,
        domain:         interview.domain,
        completedAt:    interview.completedAt,
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
