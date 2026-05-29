import axios from 'axios';
import { generateQuestion as mockQuestion, evaluateAnswer as mockEvaluate } from './mockAI.js';

const USE_MOCK     = process.env.USE_MOCK_AI === 'true';
const NVIDIA_KEY   = process.env.NVIDIA_API_KEY?.startsWith('nvapi-') ? process.env.NVIDIA_API_KEY : null;
const OPENAI_KEY   = process.env.OPENAI_API_KEY?.startsWith('sk-')    ? process.env.OPENAI_API_KEY  : null;
const GEMINI_KEY   = process.env.GEMINI_API_KEY?.startsWith('AI')     ? process.env.GEMINI_API_KEY  : null;
const MODEL        = process.env.OPENAI_MODEL  || 'gpt-4o-mini';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL  || 'meta/llama-3.1-70b-instruct';

const hasRealAI = () => !USE_MOCK && !!(NVIDIA_KEY || OPENAI_KEY || GEMINI_KEY);

// Log which engine will be used
if (NVIDIA_KEY)      console.log(`🤖 AI Engine: NVIDIA NIM (${NVIDIA_MODEL})`);
else if (OPENAI_KEY) console.log(`🤖 AI Engine: OpenAI (${MODEL})`);
else if (GEMINI_KEY) console.log('🤖 AI Engine: Google Gemini');
else                 console.log('🤖 AI Engine: Mock (no valid API key found)');

// ─── NVIDIA NIM (with retry) ─────────────────────────────────────────────────
async function callNvidia(messages, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          model: NVIDIA_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 400,  // trimmed — faster response
          stream: false,
        },
        {
          timeout: 30000,   // 30s per attempt
          headers: {
            Authorization: `Bearer ${NVIDIA_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return res.data.choices[0].message.content;
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
      if (attempt < retries && isTimeout) {
        console.warn(`⏱ NVIDIA timeout (attempt ${attempt + 1}/${retries + 1}) — retrying...`);
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); // back-off
        continue;
      }
      throw err;
    }
  }
}

// ─── OpenAI ────────────────────────────────────────────────────────────────
async function callOpenAI(messages) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: MODEL, messages, temperature: 0.7, max_tokens: 600 },
    { headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content;
}

// ─── Gemini ─────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
  });
  return res.data.candidates[0].content.parts[0].text;
}

// ─── Unified AI caller (NVIDIA → OpenAI → Gemini) ────────────────────────────
async function callAI(messages, plainPrompt) {
  if (NVIDIA_KEY) return callNvidia(messages);
  if (OPENAI_KEY) return callOpenAI(messages);
  if (GEMINI_KEY) return callGemini(plainPrompt || messages.map(m => m.content).join('\n'));
  throw new Error('No AI API key configured');
}

// ─── Question Generation ──────────────────────────────────────────────────
export async function generateQuestion(type, domain, questionIndex, previousAnswers = [], isFollowUp = false, difficulty = 'intermediate') {
  if (USE_MOCK || !hasRealAI()) {
    return mockQuestion(type, domain, questionIndex, previousAnswers);
  }

  const difficultyGuide = {
    beginner:     'Ask entry-level questions. Focus on basic syntax, definitions, and simple concepts. Use plain language. Avoid advanced terms.',
    intermediate: 'Ask mid-level questions. Cover problem-solving, design patterns, common pitfalls, and real-world usage scenarios.',
    expert:       'Ask senior-level questions. Dive into architecture decisions, performance optimization, edge cases, internals, and tradeoffs.',
  }[difficulty] || 'Ask mid-level questions covering practical usage and problem-solving.';

  const contextSummary = previousAnswers.length > 0
    ? `Previous Q&A history: ${previousAnswers.slice(-2).map(a => `Q: ${a.question} | Answer: ${a.answer} | Score: ${a.score}/100`).join('; ')}`
    : 'This is the first question.';

  let systemMsg = `You are a professional technical interviewer. You are conducting a ${type} interview focused on "${domain}" at ${difficulty.toUpperCase()} difficulty.
${difficultyGuide}
${contextSummary}
This is question number ${questionIndex + 1}.
Return ONLY the question text — no preamble, no numbering, no extra commentary.`;

  if (isFollowUp) {
    systemMsg = `You are a professional technical interviewer conducting a ${type} interview focused on "${domain}" at ${difficulty.toUpperCase()} difficulty.
The candidate just provided an answer that was incomplete or lacked depth.
${contextSummary}
Based on their last answer, ask a specific FOLLOW-UP question to prompt them to expand on the missing details or clarify their vague response.
Keep it encouraging but probing. Example: "You mentioned X, but could you elaborate on Y?"
Return ONLY the follow-up question text — no preamble, no numbering, no extra commentary.`;
  }

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: 'Generate the next interview question.' },
  ];

  try {
    const question = await callAI(messages, systemMsg);
    console.log(`✅ AI generated question #${questionIndex + 1} [${difficulty}]`);
    return { question: question.trim(), questionIndex };
  } catch (err) {
    console.error('❌ AI question generation failed:', err.response?.data || err.message);
    console.log('⚠️ Falling back to mock question');
    return mockQuestion(type, domain, questionIndex, previousAnswers);
  }
}

// ─── Answer Evaluation ───────────────────────────────────────────────────────
export async function evaluateAnswer(question, answer, type, domain, questionIndex) {
  if (USE_MOCK || !hasRealAI()) {
    return mockEvaluate(question, answer, type, domain, questionIndex);
  }

  const systemMsg = 'You are an encouraging interview coach. Always respond with valid JSON only — no markdown, no extra text.';

  const userMsg = `Evaluate this interview answer.

Context: ${type} interview on "${domain}"
Q: "${question}"
Answer: "${answer}"

Rubric: 90-100=Perfect, 75-89=Very good, 60-74=Good(acceptable), 40-59=Partial, 0-39=Weak.
If the main concept is correct (even if incomplete) give at least 60.

Respond ONLY with this JSON:
{
  "score": <0-100>,
  "verdict": "<Excellent|Good|Satisfactory|Needs Improvement|Incorrect>",
  "quickFeedback": "<1 encouraging sentence the interviewer says>",
  "breakdown": { "content": <0-100>, "communication": <0-100>, "confidence": <0-100> },
  "strengths": ["<what was good>"],
  "weaknesses": ["<what to improve>"],
  "suggestedAnswer": "<ideal answer in 2-3 sentences>"
}`;

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: userMsg },
  ];

  try {
    const rawText = await callAI(messages, systemMsg + '\n' + userMsg);
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    console.log('✅ AI evaluation complete');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('❌ AI evaluation failed:', err.response?.data || err.message);
    console.log('⚠️ Falling back to mock evaluation');
    return mockEvaluate(question, answer, type, domain, questionIndex);
  }
}
