import axios from 'axios';
import { generateQuestion as mockQuestion, evaluateAnswer as mockEvaluate } from './mockAI.js';

const USE_MOCK = process.env.USE_MOCK_AI === 'true';
const NVIDIA_KEY = process.env.NVIDIA_API_KEY?.startsWith('nvapi-') ? process.env.NVIDIA_API_KEY : null;
const NVIDIA_KEY_2 = process.env.NVIDIA_API_KEY_2?.startsWith('nvapi-') ? process.env.NVIDIA_API_KEY_2 : null;
const OPENAI_KEY = process.env.OPENAI_API_KEY?.startsWith('sk-') ? process.env.OPENAI_API_KEY : null;
const GEMINI_KEY = process.env.GEMINI_API_KEY?.startsWith('AI') ? process.env.GEMINI_API_KEY : null;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';

const hasRealAI = () => !USE_MOCK && !!(NVIDIA_KEY || OPENAI_KEY || GEMINI_KEY);

if (NVIDIA_KEY) console.log(`🤖 Q-Engine  : NVIDIA NIM (${NVIDIA_MODEL}) [key-1]`);
if (NVIDIA_KEY_2) console.log(`🤖 Eval-Engine: NVIDIA NIM (${NVIDIA_MODEL}) [key-2]`);
else if (OPENAI_KEY) console.log(`🤖 AI Engine: OpenAI (${MODEL})`);
else if (GEMINI_KEY) console.log('🤖 AI Engine: Google Gemini');
else console.log('🤖 AI Engine: Mock (no valid API key found)');

// ─── NVIDIA NIM caller (with retry, accepts explicit key and token limit) ──────
async function callNvidia(messages, apiKey, retries = 2, maxTokens = 180) {
  const key = apiKey || NVIDIA_KEY;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        {
          model: NVIDIA_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: maxTokens,
          stream: false,
        },
        {
          timeout: 30000,
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
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

// ─── OpenAI ─────────────────────────────────────────────────────────────────
async function callOpenAI(messages) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: MODEL, messages, temperature: 0.7, max_tokens: 600 },
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

// ─── AI caller for QUESTION GENERATION (uses NVIDIA_KEY / key-1) ─────────────
async function callAIForQuestion(messages, plainPrompt) {
  if (NVIDIA_KEY) return callNvidia(messages, NVIDIA_KEY);
  if (OPENAI_KEY) return callOpenAI(messages);
  if (GEMINI_KEY) return callGemini(plainPrompt || messages.map(m => m.content).join('\n'));
  throw new Error('No AI API key configured');
}

// ─── AI caller for EVALUATION (uses 750 tokens — full JSON needs more space) ──
async function callAIForEval(messages, plainPrompt) {
  const EVAL_TOKENS = 750; // evaluation JSON is large — needs plenty of space
  if (NVIDIA_KEY_2) return callNvidia(messages, NVIDIA_KEY_2, 2, EVAL_TOKENS);
  if (NVIDIA_KEY)   return callNvidia(messages, NVIDIA_KEY,   2, EVAL_TOKENS);
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
    beginner: 'Ask entry-level questions. Focus on basic syntax, definitions, and simple concepts. Use plain language. Avoid advanced terms.',
    intermediate: 'Ask mid-level questions. Cover problem-solving, design patterns, common pitfalls, and real-world usage scenarios.',
    expert: 'Ask senior-level questions. Dive into architecture decisions, performance optimization, edge cases, internals, and tradeoffs.',
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
    const question = await callAIForQuestion(messages, systemMsg);
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

  const systemMsg = 'You are a strict but fair technical interview evaluator. Always respond with valid JSON only — no markdown, no extra text, no explanation outside JSON.';

  const userMsg = `Evaluate this technical interview answer precisely.

Interview type: ${type}
Domain: ${domain}
Question: "${question}"
Candidate's Answer: "${answer}"

Scoring Rubric (be strict and accurate):
- 90-100: Perfect — complete, accurate, uses correct terminology, well-explained
- 75-89:  Very good — mostly correct, minor gaps or imprecise phrasing  
- 60-74:  Acceptable — core concept correct but lacks depth or examples
- 40-59:  Partial — shows some understanding but significant gaps or errors
- 20-39:  Weak — vague, mostly incorrect, or largely irrelevant answer
- 0-19:   Wrong or no meaningful answer given

Important rules:
- Do NOT automatically give 60+ for partial answers. Judge strictly.
- A one-word or one-sentence answer that misses key concepts should score 20-40.
- Only give 90+ if the answer is genuinely comprehensive and technically accurate.
- The "suggestedAnswer" must be a concise model answer a senior engineer would give (2-3 sentences).
- "quickFeedback" is one natural sentence the interviewer would say out loud.
- "strengths" and "weaknesses" must be specific to THIS answer, not generic.

Respond ONLY with this exact JSON (no markdown, no extra text):
{
  "score": <0-100>,
  "verdict": "<Excellent|Good|Satisfactory|Needs Improvement|Incorrect>",
  "quickFeedback": "<1 sentence the interviewer says — honest but encouraging>",
  "breakdown": { "content": <0-100>, "communication": <0-100>, "confidence": <0-100> },
  "strengths": ["<specific thing the candidate did well>"],
  "weaknesses": ["<specific gap or error in their answer>"],
  "suggestedAnswer": "<ideal 2-3 sentence answer a senior engineer would give>"
}`;

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: userMsg },
  ];

  try {
    const rawText = await callAIForEval(messages, systemMsg + '\n' + userMsg);
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    console.log('✅ AI evaluation complete');
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('❌ AI evaluation failed:', err.response?.data || err.message);
    console.log('⚠️ Falling back to mock evaluation');
    return mockEvaluate(question, answer, type, domain, questionIndex);
  }
}
