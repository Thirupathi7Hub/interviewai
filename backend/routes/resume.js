import express from 'express';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// ─── POST /api/resume/parse ───────────────────────────────────────────────────
// Accepts plain extracted text from a PDF resume (parsed on the frontend)
// and returns structured context to inject into interview question prompts.
router.post('/parse', authMiddleware, async (req, res) => {
  try {
    const { text, fileName } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 50) {
      return res.status(400).json({ error: 'Resume text is too short or missing.' });
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Name: usually the first meaningful non-empty line
    const candidateName = lines[0] || 'Candidate';

    // Skills: match known skill keywords anywhere in the text
    const skillKeywords = [
      'javascript','typescript','python','java','react','node','express','mongodb',
      'sql','postgresql','mysql','redis','docker','kubernetes','aws','azure','gcp',
      'git','html','css','tailwind','next','vue','angular','graphql','rest','api',
      'machine learning','deep learning','tensorflow','pytorch','pandas','numpy',
      'c++','c#','golang','rust','kotlin','swift','flutter','dart','php','ruby',
      'linux','bash','ci/cd','agile','scrum','figma','photoshop','spring','django',
    ];
    const textLower = text.toLowerCase();
    const foundSkills = skillKeywords.filter(skill => textLower.includes(skill));

    // Experience: lines that mention years (e.g. "2020 - 2023", "Jan 2022")
    const yearPattern = /\b(19|20)\d{2}\b/;
    const experienceLines = lines
      .filter(l => yearPattern.test(l) && l.length > 10)
      .slice(0, 6);

    // Education: lines mentioning degrees or institutions
    const eduKeywords = ['bachelor', 'master', 'b.tech', 'm.tech', 'b.e', 'm.e',
      'bsc', 'msc', 'university', 'college', 'institute', 'degree', 'diploma'];
    const educationLines = lines
      .filter(l => eduKeywords.some(k => l.toLowerCase().includes(k)))
      .slice(0, 3);

    // Clean summary for AI prompt injection (first 1200 chars)
    const rawSummary = text.replace(/\s+/g, ' ').trim().slice(0, 1200);

    const resumeContext = {
      candidateName,
      skills:          foundSkills.slice(0, 20),
      experienceLines,
      educationLines,
      rawSummary,
      fileName:        fileName || 'resume.pdf',
    };

    console.log(`📄 Resume parsed: ${candidateName} | ${foundSkills.length} skills`);
    res.json(resumeContext);

  } catch (err) {
    console.error('Resume parse error:', err.message);
    res.status(500).json({ error: 'Failed to process resume. Please try again.' });
  }
});

export default router;
