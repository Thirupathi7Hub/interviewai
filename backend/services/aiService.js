import axios from 'axios';
import { generateQuestion as mockQuestion, evaluateAnswer as mockEvaluate } from './mockAI.js';

const USE_MOCK = process.env.USE_MOCK_AI === 'true';

// AI 1 — Question Generation
const NVIDIA_KEY   = process.env.NVIDIA_API_KEY?.startsWith('nvapi-')  ? process.env.NVIDIA_API_KEY  : null;
const MODEL_QUESTIONS = process.env.NVIDIA_MODEL      || 'meta/llama-3.1-8b-instruct';

// AI 2 — Answer Evaluation (separate key + model for true parallel)
const NVIDIA_KEY_2 = process.env.NVIDIA_API_KEY_2?.startsWith('nvapi-') ? process.env.NVIDIA_API_KEY_2 : null;
const MODEL_EVAL   = process.env.NVIDIA_MODEL_EVAL   || 'meta/llama-3.1-8b-instruct';

// Fallback providers
const OPENAI_KEY   = process.env.OPENAI_API_KEY?.startsWith('sk-')     ? process.env.OPENAI_API_KEY   : null;
const GEMINI_KEY   = process.env.GEMINI_API_KEY?.startsWith('AI')      ? process.env.GEMINI_API_KEY   : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const hasRealAI = () => !USE_MOCK && !!(NVIDIA_KEY || OPENAI_KEY || GEMINI_KEY);

if (NVIDIA_KEY)   console.log(`🤖 Question AI : NVIDIA (${MODEL_QUESTIONS}) key-1`);
if (NVIDIA_KEY_2) console.log(`🤖 Eval AI     : NVIDIA (${MODEL_EVAL}) key-2`);
else if (NVIDIA_KEY) console.log(`🤖 Eval AI     : NVIDIA (${MODEL_EVAL}) key-1 (shared)`);
else if (OPENAI_KEY) console.log(`🤖 Fallback    : OpenAI (${OPENAI_MODEL})`);
else if (GEMINI_KEY) console.log('🤖 Fallback    : Google Gemini');
else                 console.log('🤖 AI Engine   : Mock (no valid API key)');

// ─── NVIDIA caller — accepts key + model ─────────────────────────────────────
async function callNvidia(messages, model, apiKey, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        { model, messages, temperature: 0.7, max_tokens: 500, stream: false },
        {
          timeout: 30000,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        }
      );
      return res.data.choices[0].message.content;
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
      if (attempt < retries && isTimeout) {
        console.warn(`⏱ NVIDIA timeout (attempt ${attempt + 1}/${retries + 1}) — retrying...`);
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
async function callOpenAI(messages) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: OPENAI_MODEL, messages, temperature: 0.7, max_tokens: 600 },
    { headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content;
}

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  });
  return res.data.candidates[0].content.parts[0].text;
}

// ─── AI 1: Questions — uses NVIDIA_KEY + MODEL_QUESTIONS ─────────────────────
async function callQuestionAI(messages, plainPrompt) {
  if (NVIDIA_KEY) return callNvidia(messages, MODEL_QUESTIONS, NVIDIA_KEY);
  if (OPENAI_KEY) return callOpenAI(messages);
  if (GEMINI_KEY) return callGemini(plainPrompt || messages.map(m => m.content).join('\n'));
  throw new Error('No AI API key configured');
}

// ─── AI 2: Evaluation — uses NVIDIA_KEY_2 + MODEL_EVAL (separate, parallel-safe)
async function callEvalAI(messages, plainPrompt) {
  const key = NVIDIA_KEY_2 || NVIDIA_KEY;   // prefer key-2, fall back to key-1
  if (key) return callNvidia(messages, MODEL_EVAL, key);
  if (OPENAI_KEY) return callOpenAI(messages);
  if (GEMINI_KEY) return callGemini(plainPrompt || messages.map(m => m.content).join('\n'));
  throw new Error('No AI API key configured');
}

// ─── Generate Question ────────────────────────────────────────────────────────
export async function generateQuestion(type, domain, questionIndex, previousAnswers = [], isFollowUp = false, difficulty = 'intermediate') {
  if (USE_MOCK || !hasRealAI()) return mockQuestion(type, domain, questionIndex, previousAnswers);

  const difficultyGuide = {
    beginner:     'Ask entry-level questions. Focus on basic syntax, definitions, and simple concepts. Use plain language. Avoid advanced terms.',
    intermediate: 'Ask mid-level questions. Cover problem-solving, design patterns, common pitfalls, and real-world usage scenarios.',
    expert:       'Ask senior-level questions. Dive into architecture decisions, performance optimization, edge cases, internals, and tradeoffs.',
  }[difficulty] || 'Ask mid-level questions covering practical usage and problem-solving.';

  const contextSummary = previousAnswers.length > 0
    ? `Previous Q&A: ${previousAnswers.slice(-2).map(a => `Q: ${a.question} | Answer: ${a.answer} | Score: ${a.score}/100`).join('; ')}`
    : 'This is the first question.';

  let systemMsg = `You are a professional technical interviewer conducting a ${type} interview on "${domain}" at ${difficulty.toUpperCase()} level.
${difficultyGuide}
${contextSummary}
This is question number ${questionIndex + 1}.
Return ONLY the question text — no preamble, no numbering, no extra commentary.`;

  if (isFollowUp) {
    systemMsg = `You are a professional technical interviewer conducting a ${type} interview on "${domain}" at ${difficulty.toUpperCase()} level.
The candidate just gave an incomplete answer. Based on their last answer, ask a FOLLOW-UP question to probe deeper.
${contextSummary}
Return ONLY the follow-up question text — no preamble, no numbering.`;
  }

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user',   content: 'Generate the next interview question.' },
  ];

  try {
    const question = await callQuestionAI(messages, systemMsg);
    console.log(`✅ Question AI: question #${questionIndex + 1} [${difficulty}] via ${MODEL_QUESTIONS}`);
    return { question: question.trim(), questionIndex };
  } catch (err) {
    console.error('❌ Question AI failed:', err.response?.data || err.message);
    return mockQuestion(type, domain, questionIndex, previousAnswers);
  }
}

// ─── Evaluate Answer ──────────────────────────────────────────────────────────
export async function evaluateAnswer(question, answer, type, domain, questionIndex) {
  if (USE_MOCK || !hasRealAI()) return mockEvaluate(question, answer, type, domain, questionIndex);

  const systemMsg = 'You are an encouraging interview coach. Always respond with valid JSON only — no markdown, no extra text.';

  const userMsg = `Evaluate this interview answer.

Context: ${type} interview on "${domain}"
Q: "${question}"
Answer: "${answer}"

Rubric: 90-100=Perfect, 75-89=Very good, 60-74=Good, 40-59=Partial, 0-39=Weak.
If the main concept is correct (even if incomplete) give at least 60.

Respond ONLY with this JSON:
{
  "score": <0-100>,
  "verdict": "<Excellent|Good|Satisfactory|Needs Improvement|Incorrect>",
  "quickFeedback": "<1 encouraging sentence>",
  "breakdown": { "content": <0-100>, "communication": <0-100>, "confidence": <0-100> },
  "strengths": ["<what was good>"],
  "weaknesses": ["<what to improve>"],
  "suggestedAnswer": "<ideal answer in 2-3 sentences>"
}`;

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user',   content: userMsg },
  ];

  try {
    const rawText = await callEvalAI(messages, systemMsg + '\n' + userMsg);

    // Extract JSON even if model wraps it in markdown or extra text
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    // Sanitize: detect error-like responses the model accidentally puts in fields
    const looksLikeError = (s) => typeof s === 'string' &&
      /(sorry|trouble processing|try again|cannot process|i apologize)/i.test(s);

    const verdicts = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Incorrect'];
    const score = (typeof parsed.score === 'number' && parsed.score >= 0 && parsed.score <= 100)
      ? parsed.score : 65;

    const result = {
      score,
      verdict:         verdicts.includes(parsed.verdict) ? parsed.verdict : (score >= 80 ? 'Good' : 'Satisfactory'),
      quickFeedback:   looksLikeError(parsed.quickFeedback)  ? 'Good effort! Keep going.' : (parsed.quickFeedback  || 'Good effort! Keep going.'),
      breakdown:       parsed.breakdown || { content: score, communication: score, confidence: score },
      strengths:       Array.isArray(parsed.strengths)  ? parsed.strengths  : ['Showed understanding of the topic'],
      weaknesses:      Array.isArray(parsed.weaknesses) ? parsed.weaknesses : ['Could elaborate more'],
      suggestedAnswer: looksLikeError(parsed.suggestedAnswer) ? '' : (parsed.suggestedAnswer || ''),
    };

    console.log(`✅ Eval AI: score=${result.score} [${result.verdict}] via ${MODEL_EVAL}`);
    return result;
  } catch (err) {
    console.error('❌ Eval AI failed:', err.response?.data || err.message);
    return mockEvaluate(question, answer, type, domain, questionIndex);
  }
}
