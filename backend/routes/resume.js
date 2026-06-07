import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Store file in memory (no disk write needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

// ─── POST /api/resume/parse ───────────────────────────────────────────────────
// Accepts a PDF resume, extracts text, and returns structured context
// that will be injected into the interview question prompts.
router.post('/parse', authMiddleware, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    // Parse the PDF buffer
    const data = await pdfParse(req.file.buffer);
    const text = data.text || '';

    if (!text.trim()) {
      return res.status(422).json({ error: 'Could not extract text from this PDF. Try a non-scanned resume.' });
    }

    // ── Extract structured info from raw text ────────────────────────────────
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Name: usually the first non-empty line
    const candidateName = lines[0] || 'Candidate';

    // Skills: find lines containing common skill keywords
    const skillKeywords = [
      'javascript','typescript','python','java','react','node','express','mongodb',
      'sql','postgresql','mysql','redis','docker','kubernetes','aws','azure','gcp',
      'git','html','css','tailwind','next','vue','angular','graphql','rest','api',
      'machine learning','deep learning','tensorflow','pytorch','pandas','numpy',
      'c++','c#','golang','rust','kotlin','swift','flutter','dart','php','ruby',
      'linux','bash','ci/cd','agile','scrum','figma','photoshop',
    ];
    const foundSkills = [];
    const textLower = text.toLowerCase();
    for (const skill of skillKeywords) {
      if (textLower.includes(skill)) foundSkills.push(skill);
    }

    // Experience: look for lines with year patterns (e.g. 2020 - 2023, Jan 2022)
    const yearPattern = /\b(19|20)\d{2}\b/;
    const experienceLines = lines.filter(l => yearPattern.test(l) && l.length > 10).slice(0, 6);

    // Education: look for degree/university keywords
    const eduKeywords = ['bachelor', 'master', 'b.tech', 'm.tech', 'b.e', 'm.e', 'bsc', 'msc',
      'university', 'college', 'institute', 'degree', 'diploma'];
    const educationLines = lines.filter(l =>
      eduKeywords.some(k => l.toLowerCase().includes(k))
    ).slice(0, 3);

    // Build a clean summary (first 1200 chars of text, stripped of extra whitespace)
    const cleanedText = text.replace(/\s+/g, ' ').trim().slice(0, 1200);

    const resumeContext = {
      candidateName,
      skills: foundSkills.slice(0, 20),
      experienceLines,
      educationLines,
      rawSummary: cleanedText,  // full context injected into question prompt
      fileName: req.file.originalname,
      charCount: text.length,
    };

    console.log(`📄 Resume parsed: ${candidateName} | ${foundSkills.length} skills found`);
    res.json(resumeContext);

  } catch (err) {
    console.error('Resume parse error:', err.message);
    if (err.message?.includes('Only PDF')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to parse resume. Please try again.' });
  }
});

export default router;
