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
async function callOpenAI(messages, maxTokens = 600) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    { model: MODEL, messages, temperature: 0.7, max_tokens: maxTokens },
    { headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' } }
  );
  return res.data.choices[0].message.content;
}

// ─── Gemini ──────────────────────────────────────────────────────────────────
async function callGemini(prompt, maxTokens = 600) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
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
async function callAIForEval(messages, plainPrompt, maxTokens = 500) {
  if (NVIDIA_KEY_2) return callNvidia(messages, NVIDIA_KEY_2, 2, maxTokens);
  if (NVIDIA_KEY)   return callNvidia(messages, NVIDIA_KEY,   2, maxTokens);
  if (OPENAI_KEY)   return callOpenAI(messages, maxTokens);
  if (GEMINI_KEY)   return callGemini(plainPrompt || messages.map(m => m.content).join('\n'), maxTokens);
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
  const fallback = (diff = 'intermediate') => {
    const beginnerPool = [
      { question: 'What is 15% of 200?', options: { A: '20', B: '25', C: '30', D: '35' }, correct: 'C', explanation: '15/100 × 200 = 30.' },
      { question: 'Find the next number in the series: 2, 4, 8, 16, ?', options: { A: '24', B: '30', C: '32', D: '28' }, correct: 'C', explanation: 'Each term doubles: 16 × 2 = 32.' },
      { question: 'If A is taller than B, and B is taller than C, who is the shortest?', options: { A: 'A', B: 'B', C: 'C', D: 'Cannot determine' }, correct: 'C', explanation: 'A > B > C, so C is shortest.' },
      { question: 'Choose the odd one out: Apple, Mango, Banana, Carrot', options: { A: 'Apple', B: 'Mango', C: 'Carrot', D: 'Banana' }, correct: 'C', explanation: 'Carrot is a vegetable; the rest are fruits.' },
      { question: 'A rectangle has length 8 cm and width 5 cm. What is its area?', options: { A: '26 cm²', B: '40 cm²', C: '13 cm²', D: '80 cm²' }, correct: 'B', explanation: 'Area = 8 × 5 = 40 cm².' },
      { question: 'What is the square root of 144?', options: { A: '11', B: '12', C: '13', D: '14' }, correct: 'B', explanation: '12 × 12 = 144.' },
      { question: 'Find the average of 10, 20, 30, 40, 50.', options: { A: '25', B: '30', C: '35', D: '40' }, correct: 'B', explanation: 'Sum = 150, Count = 5, Average = 30.' },
      { question: 'If 3x + 6 = 18, what is x?', options: { A: '2', B: '3', C: '4', D: '6' }, correct: 'C', explanation: '3x = 12, x = 4.' },
      { question: 'ABCDE : FGHIJ :: KLMNO : ?', options: { A: 'PQRST', B: 'QRSTU', C: 'OPQRS', D: 'MNOPQ' }, correct: 'A', explanation: 'Each group is the next 5 consecutive letters.' },
      { question: 'Find the odd one out: 4, 9, 16, 25, 35', options: { A: '4', B: '25', C: '35', D: '16' }, correct: 'C', explanation: '35 is not a perfect square; the rest are.' },
      { question: 'If a pen costs ₹15, how much will 6 pens cost?', options: { A: '₹80', B: '₹90', C: '₹95', D: '₹100' }, correct: 'B', explanation: '15 × 6 = ₹90.' },
      { question: 'Find the next letter in the series: A, C, E, G, ?', options: { A: 'H', B: 'I', C: 'J', D: 'K' }, correct: 'B', explanation: 'Alternate letters in the alphabet.' },
      { question: 'What is the perimeter of a square with side 6 cm?', options: { A: '12 cm', B: '18 cm', C: '24 cm', D: '36 cm' }, correct: 'C', explanation: 'Perimeter = 4 × side = 4 × 6 = 24 cm.' },
      { question: 'Choose the odd one out: Circle, Square, Triangle, Red', options: { A: 'Circle', B: 'Square', C: 'Red', D: 'Triangle' }, correct: 'C', explanation: 'Red is a color; the others are shapes.' },
      { question: 'If a book has 120 pages and you read 30 pages, what fraction of the book is left?', options: { A: '1/4', B: '1/2', C: '3/4', D: '2/3' }, correct: 'C', explanation: 'Pages left = 90. Fraction left = 90/120 = 3/4.' },
      { question: 'What is 1000 - 345?', options: { A: '655', B: '665', C: '555', D: '565' }, correct: 'A', explanation: '1000 - 345 = 655.' },
      { question: 'If 4 apples cost ₹80, what is the cost of 1 apple?', options: { A: '₹15', B: '₹20', C: '₹25', D: '₹30' }, correct: 'B', explanation: 'Cost per apple = 80 / 4 = ₹20.' },
      { question: 'Which of the following is a prime number?', options: { A: '9', B: '15', C: '17', D: '21' }, correct: 'C', explanation: '17 has no divisors other than 1 and itself.' },
      { question: 'Find the next number: 10, 20, 30, 40, ?', options: { A: '45', B: '50', C: '60', D: '55' }, correct: 'B', explanation: 'Each term increases by 10.' },
      { question: 'If x + 5 = 12, what is x?', options: { A: '5', B: '6', C: '7', D: '8' }, correct: 'C', explanation: 'x = 12 - 5 = 7.' }
    ];

    const intermediatePool = [
      { question: 'If a train travels 60 km in 1 hour, how far will it travel in 2.5 hours?', options: { A: '120 km', B: '150 km', C: '180 km', D: '100 km' }, correct: 'B', explanation: '60 × 2.5 = 150 km.' },
      { question: 'A shop offers 20% discount on a ₹500 item. What is the final price?', options: { A: '₹350', B: '₹380', C: '₹400', D: '₹420' }, correct: 'C', explanation: '500 − (20% of 500) = 500 − 100 = ₹400.' },
      { question: 'A car covers 120 km in 3 hours. What is its speed?', options: { A: '30 km/h', B: '40 km/h', C: '50 km/h', D: '60 km/h' }, correct: 'B', explanation: 'Speed = 120 / 3 = 40 km/h.' },
      { question: 'If 5 workers finish a job in 10 days, how many days will 10 workers take?', options: { A: '20 days', B: '10 days', C: '5 days', D: '8 days' }, correct: 'C', explanation: 'More workers = fewer days. 5 × 10 / 10 = 5 days.' },
      { question: 'What comes next: Monday, Wednesday, Friday, ?', options: { A: 'Saturday', B: 'Sunday', C: 'Tuesday', D: 'Thursday' }, correct: 'B', explanation: 'Every alternate day — Sunday follows Friday.' },
      { question: 'If today is Thursday, what day will it be after 100 days?', options: { A: 'Sunday', B: 'Monday', C: 'Saturday', D: 'Tuesday' }, correct: 'C', explanation: '100 mod 7 = 2. Thursday + 2 = Saturday.' },
      { question: 'A pipe fills a tank in 4 hours; another empties it in 8 hours. How long to fill when both are open?', options: { A: '6 hours', B: '8 hours', C: '10 hours', D: '12 hours' }, correct: 'B', explanation: 'Net rate = 1/4 − 1/8 = 1/8. Time = 8 hours.' },
      { question: 'What percentage is 45 out of 180?', options: { A: '20%', B: '25%', C: '30%', D: '15%' }, correct: 'B', explanation: '45/180 × 100 = 25%.' },
      { question: 'If the cost price is ₹200 and selling price is ₹250, what is the profit percentage?', options: { A: '20%', B: '25%', C: '30%', D: '15%' }, correct: 'B', explanation: 'Profit = 50, Profit% = 50/200 × 100 = 25%.' },
      { question: 'A sum of money doubles itself in 5 years at simple interest. What is the interest rate?', options: { A: '10%', B: '15%', C: '20%', D: '25%' }, correct: 'C', explanation: 'R = (SI × 100)/(P × T) = 100/5 = 20%.' },
      { question: 'In a class of 60 students, 40% are girls. How many boys are there?', options: { A: '24', B: '30', C: '36', D: '40' }, correct: 'C', explanation: 'Girls = 24. Boys = 60 - 24 = 36.' },
      { question: 'If a card is drawn from a standard deck, what is the probability it is a King?', options: { A: '1/13', B: '1/52', C: '1/4', D: '4/13' }, correct: 'A', explanation: '4 Kings out of 52 cards = 4/52 = 1/13.' },
      { question: 'What is the value of log(100) to base 10?', options: { A: '10', B: '2', C: '1', D: '0' }, correct: 'B', explanation: 'log10(100) = log10(10^2) = 2.' },
      { question: 'If 12 men can build a wall in 8 days, how many men are needed to build it in 6 days?', options: { A: '14', B: '16', C: '18', D: '20' }, correct: 'B', explanation: 'M1*D1 = M2*D2 => 12 * 8 = M2 * 6 => M2 = 16.' },
      { question: 'A vendor buys lemons at 6 for ₹10 and sells them at 4 for ₹10. What is his profit percentage?', options: { A: '25%', B: '33.33%', C: '50%', D: '60%' }, correct: 'C', explanation: 'Profit percentage = (10/20) * 100 = 50%.' },
      { question: 'Find the missing term: 1, 4, 9, ?, 25, 36', options: { A: '12', B: '15', C: '16', D: '20' }, correct: 'C', explanation: 'The series consists of perfect squares: 1^2, 2^2, 3^2, 4^2, 5^2, 6^2.' },
      { question: 'If CAT is coded as 3120, how is DOG coded?', options: { A: '4157', B: '4156', C: '4147', D: '3157' }, correct: 'A', explanation: 'Letters coded by alphabetic position: D=4, O=15, G=7.' },
      { question: 'If a two-digit number has its tens digit 3 more than its units digit, and the sum of digits is 9, what is the number?', options: { A: '54', B: '63', C: '72', D: '81' }, correct: 'B', explanation: 'x + (x+3) = 9 => x=3. Number is 63.' },
      { question: 'A, B, and C can do a work in 10, 15, and 30 days respectively. How long will they take together?', options: { A: '5 days', B: '6 days', C: '8 days', D: '10 days' }, correct: 'A', explanation: 'Combined rate = 1/10 + 1/15 + 1/30 = 1/5. Time = 5 days.' },
      { question: 'The average of five consecutive numbers is 20. What is the largest of these numbers?', options: { A: '20', B: '21', C: '22', D: '24' }, correct: 'C', explanation: 'The numbers are 18, 19, 20, 21, 22. Largest is 22.' }
    ];

    const expertPool = [
      { question: 'A jar contains milk and water in the ratio 4:1. When 10 litres of mixture is replaced with water, the ratio becomes 2:3. What was the initial quantity of milk?', options: { A: '16 litres', B: '20 litres', C: '24 litres', D: '32 litres' }, correct: 'B', explanation: 'Solving mixture equation yields initial milk = 20 litres.' },
      { question: 'In how many different ways can the letters of the word "LEADING" be arranged such that the vowels always come together?', options: { A: '360', B: '720', C: '1440', D: '5040' }, correct: 'B', explanation: 'Vowels grouped as 1 unit: 5! × 3! = 120 × 6 = 720 ways.' },
      { question: 'A bag contains 6 black and 8 white balls. If two balls are drawn at random, what is the probability that they are of the same color?', options: { A: '43/91', B: '48/91', C: '5/14', D: '3/7' }, correct: 'A', explanation: 'P = (6C2 + 8C2) / 14C2 = (15 + 28) / 91 = 43/91.' },
      { question: 'A man rows 6 km/h in still water. If current speed is 2 km/h, it takes him 3 hours to row to a place and back. How far is the place?', options: { A: '6 km', B: '8 km', C: '9 km', D: '12 km' }, correct: 'B', explanation: 'd/8 + d/4 = 3 hours => 3d/8 = 3 => d = 8 km.' },
      { question: 'A sum of money compound interest amounts to ₹672 in 2 years and ₹714 in 3 years. What is the rate of interest?', options: { A: '5%', B: '6%', C: '6.25%', D: '7.5%' }, correct: 'C', explanation: 'Rate = (42 / 672) × 100 = 6.25%.' },
      { question: 'If 2^x = 4^y = 8^z and xyz = 288, what is the value of 1/(2x) + 1/(4y) + 1/(8z)?', options: { A: '11/96', B: '11/48', C: '9/32', D: '7/48' }, correct: 'A', explanation: 'x = 2y = 3z, so 6z^3 = 288 => z=4, y=6, x=12. Sum = 1/24 + 1/24 + 1/32 = 11/96.' },
      { question: 'Three partners shared profits in the ratio 5:7:8. They partnered for 14, 8, and 7 months. What was their investment ratio?', options: { A: '20:49:64', B: '35:28:24', C: '20:35:64', D: '38:28:21' }, correct: 'A', explanation: 'Investment ratio = 5/14 : 7/8 : 8/7 = 20:49:64.' },
      { question: 'If a clock strikes once at 1 o\'clock, twice at 2 o\'clock, and so on, how many times will it strike in 24 hours?', options: { A: '78', B: '156', C: '200', D: '300' }, correct: 'B', explanation: 'Sum of 1 to 12 is 78. In 24 hours: 78 × 2 = 156.' },
      { question: 'A circular cone has volume 100π cm³ and height 12 cm. What is its lateral surface area?', options: { A: '60π cm²', B: '65π cm²', C: '70π cm²', D: '75π cm²' }, correct: 'B', explanation: 'Radius r = 5. Slant height l = 13. Lateral Area = πrl = 65π.' },
      { question: 'Find the units digit of 7^95 - 3^58.', options: { A: '0', B: '4', C: '6', D: '8' }, correct: 'B', explanation: '7^95 ends in 3, 3^58 ends in 9. 13 − 9 = 4.' },
      { question: 'If x + 1/x = 5, what is the value of x^3 + 1/x^3?', options: { A: '110', B: '115', C: '120', D: '125' }, correct: 'A', explanation: 'x^3 + 1/x^3 = (x + 1/x)^3 - 3(x + 1/x) = 125 - 15 = 110.' },
      { question: 'Two trains of lengths 140 m and 160 m run in opposite directions on parallel tracks at 60 km/h and 30 km/h. How long to cross?', options: { A: '10 seconds', B: '12 seconds', C: '15 seconds', D: '18 seconds' }, correct: 'B', explanation: 'Relative speed = 90 km/h = 25 m/s. Time = 300 / 25 = 12 seconds.' },
      { question: 'Madhan is 5 years old. Anup is 2 years younger. Gagan\'s age minus 6, divided by 18, is Anup\'s age. Gagan\'s age is:', options: { A: '48', B: '54', C: '60', D: '62' }, correct: 'C', explanation: 'Anup = 3. (G - 6)/18 = 3 => G = 60.' },
      { question: 'A card is drawn from a pack of 52 cards. What is the probability that it is a spade or a King?', options: { A: '4/13', B: '17/52', C: '9/26', D: '4/13' }, correct: 'A', explanation: 'Spades (13) + Kings (4) − spade King (1) = 16. P = 16/52 = 4/13.' },
      { question: 'A cube of side 4 cm is painted green and cut into 1-cm cubes. How many small cubes have exactly two sides painted?', options: { A: '8', B: '16', C: '24', D: '32' }, correct: 'C', explanation: 'Cubes on edges: 12 edges × (4 - 2) = 24.' },
      { question: 'What is the angle between the hands of a clock at 8:30?', options: { A: '60°', B: '75°', C: '85°', D: '90°' }, correct: 'B', explanation: 'Angle = |30(8) - 5.5(30)| = |240 - 165| = 75°.' },
      { question: 'Circles of radii 8 cm and 2 cm have centers 10 cm apart. What is the length of their direct common tangent?', options: { A: '6 cm', B: '8 cm', C: '10 cm', D: '12 cm' }, correct: 'B', explanation: 'Tangent = sqrt(d^2 - (R - r)^2) = sqrt(100 - 36) = 8 cm.' },
      { question: 'A, B, C run around circular stadium in 252s, 308s, and 198s. After what time will they meet at starting point?', options: { A: '26 mins 18s', B: '42 mins 36s', C: '46 mins 12s', D: '48 mins 12s' }, correct: 'C', explanation: 'LCM of 252, 308, 198 = 2772 seconds = 46 mins 12s.' },
      { question: 'If the letters of the word "COACH" are arranged in all possible ways and listed alphabetically, what is COACH\'s rank?', options: { A: '32nd', B: '34th', C: '36th', D: '38th' }, correct: 'B', explanation: 'Permutations before COACH alphabetically sum up to 33. COACH is 34th.' },
      { question: 'A tank has two pipes: first fills in 45m, second drains in 30m. Opened alternately for 1m, time to empty full tank is:', options: { A: '177 mins', B: '178 mins', C: '179 mins', D: '180 mins' }, correct: 'C', explanation: 'By calculating alternate filling/draining rates, it takes 179 minutes.' }
    ];

    let pool = intermediatePool;
    if (diff === 'beginner') pool = beginnerPool;
    else if (diff === 'expert') pool = expertPool;

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  if (!hasRealAI()) return fallback(difficulty);

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
    const maxTokensForAptitude = count > 10 ? 3000 : count > 5 ? 2000 : 1000;
    const rawText = await callAIForEval(messages, systemMsg, maxTokensForAptitude);
    
    // Robust extraction of JSON array from text
    let cleaned = rawText;
    const firstBracket = rawText.indexOf('[');
    const lastBracket = rawText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = rawText.substring(firstBracket, lastBracket + 1);
    } else {
      cleaned = rawText.replace(/```json|```/g, '').trim();
    }
    
    const parsed  = JSON.parse(cleaned);

    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Bad response shape');

    const valid = parsed.filter(q =>
      q.question && q.options?.A && q.options?.B && q.options?.C && q.options?.D &&
      ['A','B','C','D'].includes(q.correct)
    );

    console.log(`✅ AI generated ${valid.length}/${count} aptitude questions [${difficulty}]`);
    if (valid.length < count) {
      const extra = fallback(difficulty).slice(0, count - valid.length);
      return [...valid, ...extra];
    }
    return valid.slice(0, count);
  } catch (err) {
    console.error('❌ Aptitude AI generation failed:', err.message);
    console.log('⚠️ Falling back to mock aptitude questions');
    return fallback(difficulty);
  }
}
