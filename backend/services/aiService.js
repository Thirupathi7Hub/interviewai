import axios from 'axios';
import { generateQuestion as mockQuestion, evaluateAnswer as mockEvaluate } from './mockAI.js';

const USE_MOCK = process.env.USE_MOCK_AI === 'true';
const NVIDIA_KEY = process.env.NVIDIA_API_KEY?.startsWith('nvapi-') ? process.env.NVIDIA_API_KEY : null;
const NVIDIA_KEY_2 = process.env.NVIDIA_API_KEY_2?.startsWith('nvapi-') ? process.env.NVIDIA_API_KEY_2 : null;
const OPENAI_KEY = process.env.OPENAI_API_KEY?.startsWith('sk-') ? process.env.OPENAI_API_KEY : null;
const GEMINI_KEY = process.env.GEMINI_API_KEY?.startsWith('AI') ? process.env.GEMINI_API_KEY : null;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct';

const hasRealAI = () => !USE_MOCK && !!(NVIDIA_KEY || OPENAI_KEY || GEMINI_KEY);

if (NVIDIA_KEY) console.log(`🤖 Q-Engine  : NVIDIA NIM (${NVIDIA_MODEL}) [key-1]`);
if (NVIDIA_KEY_2) console.log(`🤖 Eval-Engine: NVIDIA NIM (${NVIDIA_MODEL}) [key-2]`);
else if (OPENAI_KEY) console.log(`🤖 AI Engine: OpenAI (${MODEL})`);
else if (GEMINI_KEY) console.log('🤖 AI Engine: Google Gemini');
else console.log('🤖 AI Engine: Mock (no valid API key found)');

// ─── NVIDIA NIM caller (with retry, accepts explicit key) ──────────────────
async function callNvidia(messages, apiKey, retries = 2, maxTokens = 150) {
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

// ─── AI caller for QUESTION GENERATION (fast: low token limit) ───────────────
async function callAIForQuestion(messages, plainPrompt) {
  if (NVIDIA_KEY) return callNvidia(messages, NVIDIA_KEY, 2, 150);  // 150 tokens = fast
  if (OPENAI_KEY) return callOpenAI(messages);
  if (GEMINI_KEY) return callGemini(plainPrompt || messages.map(m => m.content).join('\n'));
  throw new Error('No AI API key configured');
}

// ─── AI caller for EVALUATION (needs more tokens for JSON output) ─────────────
async function callAIForEval(messages, plainPrompt) {
  if (NVIDIA_KEY_2) return callNvidia(messages, NVIDIA_KEY_2, 2, 500);
  if (NVIDIA_KEY)   return callNvidia(messages, NVIDIA_KEY,   2, 500);
  if (OPENAI_KEY)   return callOpenAI(messages);
  if (GEMINI_KEY)   return callGemini(plainPrompt || messages.map(m => m.content).join('\n'));
  throw new Error('No AI API key configured');
}

// ─── Question Generation ──────────────────────────────────────────────────
export async function generateQuestion(type, domain, questionIndex, previousAnswers = [], isFollowUp = false, difficulty = 'intermediate', resumeContext = null) {
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

  // ── Build resume context block if provided ────────────────────────────────
  let resumeBlock = '';
  if (resumeContext) {
    const { candidateName, skills = [], experienceLines = [], educationLines = [] } = resumeContext;
    resumeBlock = `
CANDIDATE BACKGROUND (for personalizing questions — do NOT repeat or quote this in your output):
- Candidate: ${candidateName}
- Skills listed: ${skills.slice(0, 12).join(', ')}
${experienceLines.length ? `- Recent experience: ${experienceLines.slice(0, 2).join(' | ')}` : ''}
${educationLines.length ? `- Education: ${educationLines[0]}` : ''}

Ask about their actual listed skills and project experience. Reference specifics from their background.
CRITICAL: Your output must be ONLY the question. Never echo this resume data back.
`;
  }

  let systemMsg = `You are a professional technical interviewer. You are conducting a ${type} interview focused on "${domain}" at ${difficulty.toUpperCase()} difficulty.
${difficultyGuide}
${resumeBlock}
${contextSummary}
This is question number ${questionIndex + 1}.
IMPORTANT: Return ONLY the question text — no introduction, no preamble, no numbering, no commentary, no resume data.`;

  if (isFollowUp) {
    systemMsg = `You are a professional technical interviewer conducting a ${type} interview focused on "${domain}" at ${difficulty.toUpperCase()} difficulty.
The candidate just provided an answer that was incomplete or lacked depth.
${resumeBlock}
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
    console.log(`✅ AI generated question #${questionIndex + 1} [${difficulty}]${resumeContext ? ' [resume-tailored]' : ''}`);
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

// ─── Aptitude MCQ Generation ──────────────────────────────────────────────────
export async function generateAptitudeQuestions(count = 10, difficulty = 'intermediate') {
  // Fallback mock if no real AI
  const fallback = () => {
    const mockPool = [
      { question: 'If a train travels 60 km in 1 hour, how far will it travel in 2.5 hours?', options: { A: '120 km', B: '150 km', C: '180 km', D: '100 km' }, correct: 'B', explanation: '60 × 2.5 = 150 km.' },
      { question: 'Find the next number in the series: 2, 4, 8, 16, ?', options: { A: '24', B: '30', C: '32', D: '28' }, correct: 'C', explanation: 'Each term doubles: 16 × 2 = 32.' },
      { question: 'What is 15% of 200?', options: { A: '20', B: '25', C: '30', D: '35' }, correct: 'C', explanation: '15/100 × 200 = 30.' },
      { question: 'If A is taller than B, and B is taller than C, who is the shortest?', options: { A: 'A', B: 'B', C: 'C', D: 'Cannot determine' }, correct: 'C', explanation: 'A > B > C, so C is shortest.' },
      { question: 'A shop offers 20% discount on a ₹500 item. What is the final price?', options: { A: '₹350', B: '₹380', C: '₹400', D: '₹420' }, correct: 'C', explanation: '500 − (20% of 500) = 500 − 100 = ₹400.' },
      { question: 'Choose the odd one out: Apple, Mango, Banana, Carrot', options: { A: 'Apple', B: 'Mango', C: 'Carrot', D: 'Banana' }, correct: 'C', explanation: 'Carrot is a vegetable; the rest are fruits.' },
      { question: 'A car covers 120 km in 3 hours. What is its speed?', options: { A: '30 km/h', B: '40 km/h', C: '50 km/h', D: '60 km/h' }, correct: 'B', explanation: 'Speed = 120 / 3 = 40 km/h.' },
      { question: 'If 5 workers finish a job in 10 days, how many days will 10 workers take?', options: { A: '20 days', B: '10 days', C: '5 days', D: '8 days' }, correct: 'C', explanation: 'More workers = fewer days. 5 × 10 / 10 = 5 days.' },
      { question: 'What comes next: Monday, Wednesday, Friday, ?', options: { A: 'Saturday', B: 'Sunday', C: 'Tuesday', D: 'Thursday' }, correct: 'B', explanation: 'Every alternate day — Sunday follows Friday in this pattern.' },
      { question: 'A rectangle has length 8 cm and width 5 cm. What is its area?', options: { A: '26 cm²', B: '40 cm²', C: '13 cm²', D: '80 cm²' }, correct: 'B', explanation: 'Area = 8 × 5 = 40 cm².' },
      { question: 'What is the square root of 144?', options: { A: '11', B: '12', C: '13', D: '14' }, correct: 'B', explanation: '12 × 12 = 144.' },
      { question: 'If today is Thursday, what day will it be after 100 days?', options: { A: 'Sunday', B: 'Monday', C: 'Saturday', D: 'Tuesday' }, correct: 'C', explanation: '100 mod 7 = 2. Thursday + 2 = Saturday.' },
      { question: 'Find the average of 10, 20, 30, 40, 50.', options: { A: '25', B: '30', C: '35', D: '40' }, correct: 'B', explanation: 'Sum = 150, Count = 5, Average = 30.' },
      { question: 'A pipe fills a tank in 4 hours; another empties it in 8 hours. How long to fill when both are open?', options: { A: '6 hours', B: '8 hours', C: '10 hours', D: '12 hours' }, correct: 'B', explanation: 'Net rate = 1/4 − 1/8 = 1/8. Time = 8 hours.' },
      { question: 'Which is the largest prime number less than 20?', options: { A: '17', B: '18', C: '19', D: '16' }, correct: 'C', explanation: '19 is prime and is the largest prime less than 20.' },
      { question: 'If 3x + 6 = 18, what is x?', options: { A: '2', B: '3', C: '4', D: '6' }, correct: 'C', explanation: '3x = 12, x = 4.' },
      { question: 'ABCDE : FGHIJ :: KLMNO : ?', options: { A: 'PQRST', B: 'QRSTU', C: 'OPQRS', D: 'MNOPQ' }, correct: 'A', explanation: 'Each group is the next 5 consecutive letters.' },
      { question: 'What percentage is 45 out of 180?', options: { A: '20%', B: '25%', C: '30%', D: '15%' }, correct: 'B', explanation: '45/180 × 100 = 25%.' },
      { question: 'Find the odd one out: 4, 9, 16, 25, 35', options: { A: '4', B: '25', C: '35', D: '16' }, correct: 'C', explanation: '35 is not a perfect square; the rest are.' },
      { question: 'If the cost price is ₹200 and selling price is ₹250, what is the profit percentage?', options: { A: '20%', B: '25%', C: '30%', D: '15%' }, correct: 'B', explanation: 'Profit = 50, Profit% = 50/200 × 100 = 25%.' },
    ];
    const shuffled = [...mockPool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  if (!hasRealAI()) return fallback();

  const difficultyGuide = {
    beginner:     'Easy arithmetic, simple patterns, basic vocabulary. Suitable for freshers.',
    intermediate: 'Moderate word problems, mixed logical reasoning, moderate data interpretation.',
    expert:       'Complex multi-step problems, advanced number series, abstract reasoning, tricky verbal analogies.',
  }[difficulty] || 'Moderate questions.';

  const systemMsg = `You are an aptitude test question generator. Generate exactly ${count} multiple-choice aptitude questions.
Topics to randomly mix: Quantitative Aptitude, Logical Reasoning, Verbal Ability, Data Interpretation.
Difficulty: ${difficulty.toUpperCase()} — ${difficultyGuide}
Rules:
- Each question must have exactly 4 options labeled A, B, C, D.
- The "correct" field must be ONLY the letter: "A", "B", "C", or "D".
- "explanation" must be one concise sentence.
- Vary topics across the set — do not repeat the same topic consecutively.
- All questions must be clearly worded and unambiguous.
- Return ONLY a valid JSON array. No markdown, no prose, no code fences.

JSON format:
[
  {
    "question": "<question text>",
    "options": { "A": "<opt A>", "B": "<opt B>", "C": "<opt C>", "D": "<opt D>" },
    "correct": "A",
    "explanation": "<one sentence explanation>"
  }
]`;

  const messages = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: `Generate ${count} aptitude MCQ questions now. Return only the JSON array.` },
  ];

  try {
    const rawText = await callAIForEval(messages, systemMsg);
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed  = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Bad response shape');

    const valid = parsed.filter(q =>
      q.question && q.options?.A && q.options?.B && q.options?.C && q.options?.D &&
      ['A','B','C','D'].includes(q.correct)
    );

    console.log(`✅ AI generated ${valid.length}/${count} aptitude questions [${difficulty}]`);
    if (valid.length < count) {
      const extra = fallback().slice(0, count - valid.length);
      return [...valid, ...extra];
    }
    return valid.slice(0, count);
  } catch (err) {
    console.error('❌ Aptitude AI generation failed:', err.message);
    console.log('⚠️ Falling back to mock aptitude questions');
    return fallback();
  }
}
