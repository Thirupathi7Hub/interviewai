// ─── Mock AI Service ─────────────────────────────────────────────────────────
// Used when USE_MOCK_AI=true or when no API key is configured.
// Provides realistic, domain-aware responses for demo/development.

const questionBank = {
  Technical: {
    'Computer Science (CSE)': [
      'Can you explain the difference between a Stack and a Queue? Give real-world examples of each.',
      'Describe Floyd\'s Cycle Detection Algorithm. What is its time and space complexity?',
      'What is the difference between process and thread? How do they share resources?',
      'Explain the concept of database normalization. What are 1NF, 2NF, and 3NF?',
      'What is a deadlock in operating systems? How can it be prevented?',
      'Describe the differences between TCP and UDP protocols.',
      'What is a binary search tree? How do insertion and deletion work?',
      'Explain the concept of dynamic programming with an example.',
    ],
    'Electronics (ECE)': [
      'Explain the working principle of a BJT transistor.',
      'What is the difference between AM and FM modulation?',
      'Describe the operation of a flip-flop. What are its types?',
      'What is a microcontroller and how does it differ from a microprocessor?',
      'Explain Shannon\'s theorem and its significance in communication.',
      'What is the purpose of a multiplexer? Give an example.',
    ],
    'Mechanical (ME)': [
      'What is the difference between stress and strain?',
      'Explain the working principle of a four-stroke engine.',
      'What is thermodynamic efficiency? Define Carnot efficiency.',
      'Describe different types of manufacturing processes.',
      'What is fatigue failure and how can it be prevented?',
    ],
    default: [
      'Tell me about a technical challenge you faced and how you solved it.',
      'What is your strongest technical skill? Give an example of how you used it.',
      'Describe a project you are most proud of.',
      'How do you approach debugging a complex issue?',
      'What emerging technologies interest you and why?',
    ],
  },
  HR: {
    default: [
      'Tell me about yourself and your background.',
      'What are your greatest strengths and how do they apply to this role?',
      'Describe a time you faced a significant challenge at work or college. How did you handle it?',
      'Where do you see yourself five years from now?',
      'Tell me about a time you had to work with a difficult team member.',
      'What motivates you to do your best work?',
      'Describe a situation where you had to meet a tight deadline. How did you manage it?',
      'Why should we hire you over other candidates?',
    ],
  },
  Viva: {
    'Computer Science (CSE)': [
      'Explain the concept of virtual memory and how it works.',
      'What is the difference between compiler and interpreter?',
      'Describe the OSI model and its seven layers.',
      'What are ACID properties in database transactions?',
      'Explain the concept of polymorphism in OOP with an example.',
    ],
    'Electronics (ECE)': [
      'Explain the working of a PN junction diode.',
      'What is the difference between RISC and CISC architectures?',
      'Describe the principle of superposition in circuit analysis.',
      'What is Nyquist sampling theorem?',
      'Explain the working of an operational amplifier.',
    ],
    default: [
      'Define the fundamental theorem of your subject area.',
      'Explain a key concept from your recent coursework.',
      'How does theory apply to real-world problems in your field?',
      'Describe an experiment or project from your lab work.',
      'What are the current research trends in your domain?',
    ],
  },
};

const feedbackTemplates = [
  {
    strengths: ['Clear and structured explanation', 'Good use of examples', 'Demonstrates solid foundational knowledge'],
    weaknesses: ['Could elaborate more on edge cases', 'Time complexity analysis needs more precision', 'Consider discussing trade-offs'],
    suggestedAnswer: 'A well-structured answer should cover the definition, mechanism, complexity analysis, practical applications, and edge cases. Use the STAR method for behavioral questions.',
    scoreRange: [72, 92],
  },
  {
    strengths: ['Confident delivery', 'Correct technical terminology', 'Logical problem-solving approach'],
    weaknesses: ['Answer could be more concise', 'Missing mention of alternative approaches', 'Practical experience examples would strengthen the answer'],
    suggestedAnswer: 'Start with a brief definition, explain the mechanism with a diagram if possible, discuss time/space complexity, and conclude with real-world applications.',
    scoreRange: [68, 88],
  },
  {
    strengths: ['Good conceptual understanding', 'Relevant examples provided', 'Well-organized response'],
    weaknesses: ['Deeper analysis of complexity would help', 'Could mention more advanced use cases', 'Communication could be more concise'],
    suggestedAnswer: 'An ideal answer demonstrates both theoretical knowledge and practical application. Always back claims with examples and discuss limitations.',
    scoreRange: [65, 85],
  },
];

function getQuestions(type, domain) {
  const typeBank = questionBank[type] || questionBank.Technical;
  return typeBank[domain] || typeBank.default;
}

function generateFeedback(answer, questionIndex) {
  const template = feedbackTemplates[questionIndex % feedbackTemplates.length];
  const [min, max] = template.scoreRange;
  
  // Score based on answer length and presence of keywords (basic heuristic)
  const len = answer.trim().length;
  let score = min + Math.floor(Math.random() * (max - min));
  if (len > 200) score = Math.min(score + 5, 100);
  if (len < 30) score = Math.max(score - 15, 20);

  const verdicts = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];
  const verdict   = score >= 85 ? verdicts[0] : score >= 65 ? verdicts[1] : score >= 45 ? verdicts[2] : verdicts[3];
  const feedbacks = [
    'Great answer! You demonstrated solid understanding.',
    'Good response! A bit more detail would make it even stronger.',
    'Decent effort! Let\'s keep building on that.',
    'Keep going — practice makes perfect!',
  ];
  const quickFeedback = score >= 85 ? feedbacks[0] : score >= 65 ? feedbacks[1] : score >= 45 ? feedbacks[2] : feedbacks[3];

  return {
    score,
    verdict,
    quickFeedback,
    strengths:       template.strengths,
    weaknesses:      template.weaknesses,
    suggestedAnswer: template.suggestedAnswer,
    breakdown: {
      content:       Math.min(score + Math.floor(Math.random() * 10) - 5, 100),
      communication: Math.min(score + Math.floor(Math.random() * 10) - 5, 100),
      confidence:    Math.min(score + Math.floor(Math.random() * 10) - 5, 100),
    },
  };
}

export async function generateQuestion(type, domain, questionIndex, previousAnswers = []) {
  const questions = getQuestions(type, domain);
  const idx = Math.min(questionIndex, questions.length - 1);
  
  // Adaptive difficulty hint based on performance
  let prefix = '';
  if (questionIndex > 0 && previousAnswers.length > 0) {
    const lastAnswer = previousAnswers[previousAnswers.length - 1];
    if (lastAnswer.score > 80) {
      prefix = "Great answer! Let me challenge you further. ";
    } else if (lastAnswer.score < 50) {
      prefix = "Let's try a slightly different angle. ";
    }
  }

  return {
    question: prefix + questions[idx],
    questionIndex: idx,
  };
}

export async function evaluateAnswer(question, answer, type, domain, questionIndex) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (!answer || answer.trim().length < 3) {
    return {
      score: 0,
      strengths: [],
      weaknesses: ['No meaningful answer was provided'],
      suggestedAnswer: 'Please provide a detailed answer to receive proper evaluation.',
      breakdown: { content: 0, communication: 0, confidence: 0 },
    };
  }

  return generateFeedback(answer, questionIndex);
}
