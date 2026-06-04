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

    const TOTAL_QUESTIONS = interview.totalQuestions || 5;
    const nextIndex = questionIndex + 1;
    const isLast = nextIndex >= TOTAL_QUESTIONS;

    // Retrieve difficulty stored in first QA entry
    const difficulty = interview.qa[0]?._difficulty || 'intermediate';

    // ⚡ Run evaluation + next question generation IN PARALLEL (cuts latency in half)
    const parallelTasks = [evaluateAnswer(
      currentQA.question,
      answer,
      interview.type,
      interview.domain,
      questionIndex
    )];

    if (!isLast) {
      parallelTasks.push(generateQuestion(
        interview.type,
        interview.domain,
        nextIndex,
        interview.qa,
        false,         // isFollowUp determined after evaluation — see below
        difficulty
      ));
    }

    const [evaluation, nextQResult] = await Promise.all(parallelTasks);

    // ── Always update the current Q&A first (fixes last-question data loss) ───
    interview.qa[questionIndex].answer          = answer;
    interview.qa[questionIndex].score           = evaluation.score;
    interview.qa[questionIndex].breakdown       = evaluation.breakdown;
    interview.qa[questionIndex].strengths       = evaluation.strengths;
    interview.qa[questionIndex].weaknesses      = evaluation.weaknesses;
    interview.qa[questionIndex].suggestedAnswer = evaluation.suggestedAnswer;

    if (isLast) {
      // Calculate final score across ALL questions (including the one just answered)
      const scores = interview.qa.map(q => q.score || 0);
      const finalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

      // Aggregate strengths / improvements
      const allStrengths  = interview.qa.flatMap(q => q.strengths  || []);
      const allWeaknesses = interview.qa.flatMap(q => q.weaknesses || []);

      interview.finalScore = finalScore;

      // Average the breakdown across ALL questions
      const allBreakdowns = interview.qa
        .map(q => q.breakdown)
        .filter(b => b && typeof b.content === 'number');

      if (allBreakdowns.length > 0) {
        const avg = (key) => Math.round(
          allBreakdowns.reduce((sum, b) => sum + (b[key] || 0), 0) / allBreakdowns.length
        );
        interview.scoreBreakdown = {
          content:       avg('content'),
          communication: avg('communication'),
          confidence:    avg('confidence'),
        };
      } else {
        interview.scoreBreakdown = evaluation.breakdown || {
          content: finalScore, communication: finalScore, confidence: finalScore,
        };
      }

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

    // Use pre-generated next question (already ran in parallel)
    // If score < 60 and not a follow-up yet, regenerate as a follow-up question
    let isFollowUp = false;
    let nextQuestion = nextQResult?.question;

    if (evaluation.score < 60 && !currentQA.isFollowUp && nextIndex < TOTAL_QUESTIONS) {
      isFollowUp = true;
      // Regenerate as follow-up (short extra call, but gives targeted follow-up)
      const followUp = await generateQuestion(
        interview.type, interview.domain, nextIndex, interview.qa, true, difficulty
      );
      nextQuestion = followUp.question;
    }

    // Append next question slot
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

// ─── POST /api/interview/face-confidence ──────────────────────────────────────
// Analyzes a webcam frame using NVIDIA llama-3.2-vision model.
// Returns AI-powered confidence score, emotion, and insight.
router.post('/face-confidence', authMiddleware, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const NVIDIA_KEY = process.env.NVIDIA_NEMOTRON_KEY || process.env.NVIDIA_API_KEY;
    if (!NVIDIA_KEY?.startsWith('nvapi-')) {
      return res.json({ score: 75, emotion: 'focused', engagement: 'medium', insight: 'AI confidence analysis unavailable.' });
    }

    // Strict JSON-only prompt — no prose, no markdown
    const prompt = `Analyze this interview candidate's webcam image. Reply with ONLY valid JSON, nothing else before or after it.

{"score":<0-100>,"emotion":"<calm|focused|nervous|stressed|confident|distracted>","engagement":"<high|medium|low>","eyeContact":<true|false>,"insight":"<one short encouraging sentence>"}

Score guide: 85-100=very confident & relaxed, 65-84=reasonably confident, 45-64=some anxiety, 0-44=high stress or no face.`;

    const { default: axios } = await import('axios');
    const response = await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        // llama-3.2-11b-vision: fast (2-4s), purpose-built for image understanding
        model: 'meta/llama-3.2-11b-vision-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageBase64 } },
          ],
        }],
        temperature: 0.1,
        max_tokens: 180,
        stream: false,
      },
      {
        timeout: 12000,
        headers: {
          Authorization: `Bearer ${NVIDIA_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const raw = response.data.choices[0].message.content || '';

    // ── Robust JSON extraction ─────────────────────────────────────────────────
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (typeof result.score === 'number') {
        result.score = Math.max(0, Math.min(100, Math.round(result.score)));
        console.log(`🎯 AI face confidence: ${result.score} (${result.emotion || 'unknown'})`);
        return res.json(result);
      }
    }

    // Fallback: try to extract a number from freeform text
    const numMatch = raw.match(/\b([4-9]\d|100|[1-9]\d)\b/);
    const fallbackScore = numMatch ? Math.min(100, parseInt(numMatch[1])) : 70;
    console.warn(`⚠️ Non-JSON from vision model, extracted score: ${fallbackScore}`);
    res.json({ score: fallbackScore, emotion: 'focused', engagement: 'medium', eyeContact: true, insight: "Keep going, you're doing great!" });

  } catch (err) {
    console.error('Face confidence error:', err.message);
    res.json({ score: 70, emotion: 'focused', engagement: 'medium', eyeContact: true, insight: "Keep going, you're doing great!" });
  }
});

export default router;
