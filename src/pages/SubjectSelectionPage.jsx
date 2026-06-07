import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, CheckCircle2, X, Upload, FileText, Sparkles, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useInterview } from '../context/InterviewContext';
import client from '../api/client';

// ─── Data ────────────────────────────────────────────────────────────────────

const DEV = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';

const languages = [
  { id: 'python',     label: 'Python',         logo: `${DEV}/python/python-original.svg`,           color: '#3776ab' },
  { id: 'javascript', label: 'JavaScript',     logo: `${DEV}/javascript/javascript-original.svg`,   color: '#f7df1e' },
  { id: 'java',       label: 'Java',           logo: `${DEV}/java/java-original.svg`,               color: '#e76f00' },
  { id: 'cpp',        label: 'C++',            logo: `${DEV}/cplusplus/cplusplus-original.svg`,     color: '#00599c' },
  { id: 'c',          label: 'C',              logo: `${DEV}/c/c-original.svg`,                     color: '#a8b9cc' },
  { id: 'typescript', label: 'TypeScript',     logo: `${DEV}/typescript/typescript-original.svg`,   color: '#3178c6' },
  { id: 'go',         label: 'Go',             logo: `${DEV}/go/go-original-wordmark.svg`,          color: '#00acd7' },
  { id: 'rust',       label: 'Rust',           logo: `${DEV}/rust/rust-original.svg`,               color: '#ce422b' },
  { id: 'kotlin',     label: 'Kotlin',         logo: `${DEV}/kotlin/kotlin-original.svg`,           color: '#7f52ff' },
  { id: 'swift',      label: 'Swift',          logo: `${DEV}/swift/swift-original.svg`,             color: '#f05138' },
  { id: 'ruby',       label: 'Ruby',           logo: `${DEV}/ruby/ruby-original.svg`,               color: '#cc342d' },
  { id: 'php',        label: 'PHP',            logo: `${DEV}/php/php-original.svg`,                 color: '#777bb4' },
  { id: 'sql',        label: 'SQL',            logo: `${DEV}/mysql/mysql-original.svg`,             color: '#00758f' },
  { id: 'dart',       label: 'Dart / Flutter', logo: `${DEV}/flutter/flutter-original.svg`,         color: '#54c5f8' },
  { id: 'scala',      label: 'Scala',          logo: `${DEV}/scala/scala-original.svg`,             color: '#dc322f' },
  { id: 'r',          label: 'R',              logo: `${DEV}/r/r-original.svg`,                     color: '#276dc3' },
];

const roles = [
  { id: 'frontend',    label: 'Frontend Developer',     emoji: '🖥️', desc: 'HTML, CSS, React, UI/UX' },
  { id: 'backend',     label: 'Backend Developer',      emoji: '🔧', desc: 'APIs, Databases, Server-side' },
  { id: 'fullstack',   label: 'Full Stack Developer',   emoji: '🌐', desc: 'End-to-end web development' },
  { id: 'devops',      label: 'DevOps Engineer',        emoji: '🚀', desc: 'CI/CD, Docker, Kubernetes, Cloud' },
  { id: 'mobile',      label: 'Mobile Developer',       emoji: '📱', desc: 'iOS, Android, React Native' },
  { id: 'data',        label: 'Data Scientist',         emoji: '📊', desc: 'ML, Python, Statistics, Models' },
  { id: 'mleng',       label: 'ML Engineer',            emoji: '🤖', desc: 'Deep learning, TensorFlow, MLOps' },
  { id: 'cloud',       label: 'Cloud Engineer',         emoji: '☁️', desc: 'AWS, Azure, GCP, Infrastructure' },
  { id: 'security',    label: 'Security Engineer',      emoji: '🔐', desc: 'Cybersecurity, Penetration testing' },
  { id: 'qa',          label: 'QA / Test Engineer',     emoji: '🧪', desc: 'Testing, Automation, QA processes' },
  { id: 'dba',         label: 'Database Admin',         emoji: '🗄️', desc: 'SQL, NoSQL, Optimization, Indexing' },
  { id: 'sre',         label: 'Site Reliability Eng.',  emoji: '⚡', desc: 'Reliability, Monitoring, Incident Mgmt' },
];

const difficulties = [
  {
    id: 'beginner',
    label: 'Beginner',
    color: '#10b981',
    badge: 'Great for starters',
    desc: 'Fundamental concepts & basic syntax',
    detail: 'Simple definitions, syntax, core concepts',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    color: '#f59e0b',
    badge: 'Most popular',
    desc: 'Standard interview depth',
    detail: 'Problem solving, design patterns, real-world usage',
  },
  {
    id: 'expert',
    label: 'Expert',
    color: '#ef4444',
    badge: 'Senior-level',
    desc: 'Deep-dive & edge cases',
    detail: 'Architecture, optimization, advanced internals',
  },
];

const questionCounts = [
  { id: 5,  label: '5',  sub: 'Quick Practice',   time: '~10 min', color: '#10b981' },
  { id: 10, label: '10', sub: 'Standard Session',  time: '~20 min', color: '#f59e0b' },
  { id: 15, label: '15', sub: 'Full Interview',    time: '~30 min', color: '#ef4444' },
];

const STEPS = ['Mode', 'Topic', 'Difficulty', 'Questions', 'Resume'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubjectSelectionPage() {
  const navigate = useNavigate();
  const { startInterview } = useInterview();

  const [mode,       setMode]       = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [qCount,     setQCount]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [step,       setStep]       = useState(0); // 0=mode,1=topic,2=difficulty,3=questions,4=resume

  // Resume upload state
  const [resumeContext, setResumeContext] = useState(null);
  const [resumeFile,    setResumeFile]    = useState(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError,   setResumeError]   = useState('');
  const [dragOver,      setDragOver]      = useState(false);
  const fileInputRef = useRef(null);

  const items        = mode === 'language' ? languages : roles;
  const selectedItem = items.find(i => i.id === selected);
  const selectedDiff = difficulties.find(d => d.id === difficulty);
  const selectedQ    = questionCounts.find(q => q.id === qCount);

  // ── Resume upload handler ─────────────────────────────────────────────────
  const handleResumeUpload = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setResumeError('Please upload a PDF file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setResumeError('File too large. Max 5 MB.');
      return;
    }
    setResumeError('');
    setResumeLoading(true);
    setResumeFile(file);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await client.post('/resume/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumeContext(res.data);
    } catch (err) {
      setResumeError(err.response?.data?.error || 'Failed to parse resume.');
      setResumeFile(null);
    } finally {
      setResumeLoading(false);
    }
  }, []);

  const clearResume = () => {
    setResumeContext(null);
    setResumeFile(null);
    setResumeError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStart = async () => {
    if (!selected || !difficulty || !qCount || loading) return;
    try {
      setLoading(true);
      await startInterview(mode, selectedItem.label, qCount, difficulty, resumeContext);
      navigate('/session');
    } catch (err) {
      console.error(err);
      alert('Failed to start interview. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 0) return;
    if (step === 4) { setStep(3); }
    else if (step === 3) { setQCount(null);     setStep(2); }
    else if (step === 2) { setDifficulty(null); setStep(1); }
    else if (step === 1) { setSelected(null); setMode(null); setStep(0); }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.25 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen bg-[#0a0a0a]"
    >
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                i < step ? 'bg-gold-500 text-black' :
                i === step ? 'border-2 border-gold-500 text-gold-400' :
                'border border-white/10 text-gray-600'
              }`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-white' : 'text-gray-600'}`}>{s}</span>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-10 transition-all duration-500 ${i < step ? 'bg-gold-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 0: Mode Selection ── */}
          {step === 0 && (
            <motion.div key="step0" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
              <h1 className="text-3xl font-black text-white mb-2">Choose Interview Mode</h1>
              <p className="text-gray-400 mb-8">Practice by a specific programming language or by your job role.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('language'); setSelected(null); setStep(1); }}
                  className="group glass rounded-3xl border border-white/10 hover:border-gold-500/50 p-8 text-left flex flex-col gap-4 transition-all duration-300 shadow-lg"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl">💻</div>
                  <div>
                    <h2 className="text-xl font-bold text-white group-hover:text-gold-400 transition-colors">Programming Language</h2>
                    <p className="text-sm text-gray-400 mt-1.5">Targeted questions based on a single language: Python, JavaScript, Java, C++, and more.</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {['Python', 'JS', 'Java', 'C++', 'Go', '+more'].map(t => (
                      <span key={t} className="text-[11px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-md">{t}</span>
                    ))}
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('role'); setSelected(null); setStep(1); }}
                  className="group glass rounded-3xl border border-white/10 hover:border-gold-500/50 p-8 text-left flex flex-col gap-4 transition-all duration-300 shadow-lg"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-3xl">🎯</div>
                  <div>
                    <h2 className="text-xl font-bold text-white group-hover:text-gold-400 transition-colors">Job Role Based</h2>
                    <p className="text-sm text-gray-400 mt-1.5">Field-specific interviews for your target role: Full Stack, DevOps, Frontend, Backend, and more.</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {['Full Stack', 'DevOps', 'Frontend', 'Backend', 'ML', '+more'].map(t => (
                      <span key={t} className="text-[11px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-md">{t}</span>
                    ))}
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 1: Topic Selection ── */}
          {step === 1 && (
            <motion.div key="step1" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={goBack} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <h1 className="text-3xl font-black text-white">
                  {mode === 'language' ? 'Pick a Language' : 'Pick a Role'}
                </h1>
              </div>
              <p className="text-gray-400 mb-8 ml-8">
                {mode === 'language'
                  ? 'All questions will be tailored to the selected language.'
                  : 'Questions will cover the full skill set required for this role.'}
              </p>

              <div className={`grid gap-3 ${mode === 'language' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
                {items.map((item, i) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setSelected(item.id); setStep(2); }}
                    className={`group rounded-2xl border p-4 text-left transition-all duration-200 relative overflow-hidden ${
                      selected === item.id
                        ? 'border-gold-500/60 bg-gold-500/10'
                        : 'border-white/8 bg-white/3 hover:border-gold-500/40 hover:bg-white/6'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Real logo for languages, emoji for roles */}
                      {item.logo ? (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                          <img src={item.logo} alt={item.label} className="w-6 h-6 object-contain" />
                        </div>
                      ) : (
                        <span className="text-2xl">{item.emoji}</span>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white">{item.label}</p>
                        {mode === 'role' && <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>}
                      </div>
                    </div>
                    {selected === item.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                        <CheckCircle2 size={10} className="text-black" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Difficulty ── */}
          {step === 2 && (
            <motion.div key="step2" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={goBack} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <h1 className="text-3xl font-black text-white">Select Difficulty</h1>
              </div>

              <div className="ml-8 mb-8 flex items-center gap-2">
                <span className="text-gray-400 text-sm">Interviewing for:</span>
                <span className="text-sm font-semibold text-white bg-white/8 border border-white/10 px-3 py-1 rounded-full">
                  {selectedItem?.emoji} {selectedItem?.label}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {difficulties.map((d, i) => (
                  <motion.button
                    key={d.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setDifficulty(d.id); setStep(3); }}
                    className={`group rounded-3xl border p-8 text-left flex flex-col gap-4 transition-all duration-300 relative overflow-hidden ${
                      difficulty === d.id
                        ? 'border-[var(--d-color)] bg-[var(--d-color)]/10 shadow-lg'
                        : 'border-white/10 bg-white/3 hover:border-[var(--d-color)]/50'
                    }`}
                    style={{ '--d-color': d.color }}
                  >
                    {difficulty === d.id && (
                      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20"
                        style={{ background: d.color }} />
                    )}
                    <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                      style={{ color: d.color, borderColor: `${d.color}44`, background: `${d.color}15` }}>
                      {d.badge}
                    </div>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ background: `${d.color}18`, border: `1px solid ${d.color}33` }}>
                      {d.id === 'beginner' ? '🌱' : d.id === 'intermediate' ? '⚡' : '🔥'}
                    </div>
                    <div>
                      <p className="text-xl font-black text-white">{d.label}</p>
                      <p className="text-sm text-gray-400 mt-1">{d.desc}</p>
                      <p className="text-xs mt-2" style={{ color: `${d.color}99` }}>{d.detail}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Question Count ── */}
          {step === 3 && (
            <motion.div key="step3" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={goBack} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <h1 className="text-3xl font-black text-white">How Many Questions?</h1>
              </div>

              <div className="ml-8 mb-8 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">Session:</span>
                <span className="text-sm font-semibold text-white bg-white/8 border border-white/10 px-3 py-1 rounded-full">
                  {selectedItem?.emoji} {selectedItem?.label}
                </span>
                <span className="text-gray-600">·</span>
                <span className="text-sm font-semibold px-3 py-1 rounded-full"
                  style={{ color: selectedDiff?.color, background: `${selectedDiff?.color}15`, border: `1px solid ${selectedDiff?.color}33` }}>
                  {selectedDiff?.label}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                {questionCounts.map((q, i) => (
                  <motion.button
                    key={q.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setQCount(q.id)}
                    className={`group rounded-3xl border p-8 text-left flex flex-col gap-4 transition-all duration-300 relative overflow-hidden ${
                      qCount === q.id
                        ? 'border-[var(--q-color)] bg-[var(--q-color)]/10 shadow-lg'
                        : 'border-white/10 bg-white/3 hover:border-[var(--q-color)]/50'
                    }`}
                    style={{ '--q-color': q.color }}
                  >
                    {qCount === q.id && (
                      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20"
                        style={{ background: q.color }} />
                    )}
                    <div className="text-6xl font-black" style={{ color: q.color }}>{q.label}</div>
                    <div>
                      <p className="text-xl font-black text-white">{q.sub}</p>
                      <p className="text-sm mt-1" style={{ color: `${q.color}99` }}>{q.time}</p>
                    </div>
                    {qCount === q.id && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: q.color }}>
                        <CheckCircle2 size={14} />
                        Selected
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: qCount ? 1.02 : 1 }}
                whileTap={{ scale: qCount ? 0.98 : 1 }}
                onClick={() => { if (qCount) setStep(4); }}
                disabled={!qCount}
                className="w-full btn-gold py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <span>Continue</span><ChevronRight size={20} />
              </motion.button>

              {qCount && (
                <p className="text-center text-xs text-gray-500 mt-4">
                  {selectedItem?.emoji} {selectedItem?.label} &middot; {selectedDiff?.label} &middot; {selectedQ?.id} Questions &middot; {selectedQ?.time}
                </p>
              )}
            </motion.div>
          )}

          {/* ── STEP 4: Resume Upload (Optional) ── */}
          {step === 4 && (
            <motion.div key="step4" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={goBack} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <h1 className="text-3xl font-black text-white">Upload Your Resume</h1>
                <span className="text-xs font-semibold text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full ml-2">Optional</span>
              </div>

              <p className="text-gray-400 mb-8 ml-8">
                Upload your resume and we'll tailor interview questions to your actual skills & experience.
              </p>

              {/* Session summary */}
              <div className="ml-8 mb-8 flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">Session:</span>
                <span className="text-sm font-semibold text-white bg-white/8 border border-white/10 px-3 py-1 rounded-full">
                  {selectedItem?.emoji} {selectedItem?.label}
                </span>
                <span className="text-gray-600">·</span>
                <span className="text-sm font-semibold px-3 py-1 rounded-full"
                  style={{ color: selectedDiff?.color, background: `${selectedDiff?.color}15`, border: `1px solid ${selectedDiff?.color}33` }}>
                  {selectedDiff?.label}
                </span>
                <span className="text-gray-600">·</span>
                <span className="text-sm font-semibold text-white bg-white/8 border border-white/10 px-3 py-1 rounded-full">
                  {selectedQ?.id} Questions
                </span>
              </div>

              {/* Upload Zone */}
              {!resumeContext ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleResumeUpload(e.dataTransfer.files[0]); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-3xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 mb-8 ${
                    dragOver
                      ? 'border-gold-500 bg-gold-500/5 scale-[1.01]'
                      : 'border-white/15 bg-white/3 hover:border-gold-500/40 hover:bg-white/5'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleResumeUpload(e.target.files[0])}
                  />

                  {resumeLoading ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 size={48} className="text-gold-400 animate-spin" />
                      <p className="text-white font-semibold">Analyzing your resume...</p>
                      <p className="text-gray-500 text-sm">Extracting skills, experience & education</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gold-500/20 to-amber-600/10 border border-gold-500/20 flex items-center justify-center">
                        <Upload size={32} className="text-gold-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg">Drag & drop your resume PDF here</p>
                        <p className="text-gray-500 text-sm mt-1">or click to browse · PDF only · Max 5 MB</p>
                      </div>
                    </div>
                  )}

                  {resumeError && (
                    <p className="text-red-400 text-sm mt-4 font-medium">{resumeError}</p>
                  )}
                </div>
              ) : (
                /* Resume Parsed Successfully */
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-green-500/30 bg-green-500/5 p-6 mb-8"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                        <FileText size={22} className="text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold">{resumeContext.candidateName}</p>
                        <p className="text-gray-400 text-xs">{resumeFile?.name} · {resumeContext.skills?.length || 0} skills detected</p>
                      </div>
                    </div>
                    <button onClick={clearResume} className="text-gray-500 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Detected Skills */}
                  {resumeContext.skills?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detected Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {resumeContext.skills.map((skill) => (
                          <span key={skill} className="text-xs font-medium text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2.5 py-1 rounded-full capitalize">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Experience */}
                  {resumeContext.experienceLines?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Experience Highlights</p>
                      <div className="space-y-1">
                        {resumeContext.experienceLines.slice(0, 3).map((line, i) => (
                          <p key={i} className="text-xs text-gray-400 truncate">• {line}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-xs text-green-400 font-semibold">
                    <Sparkles size={14} />
                    Questions will be tailored to your background
                  </div>
                </motion.div>
              )}

              {/* Start Interview Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                disabled={loading}
                className="w-full btn-gold py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <><Loader2 size={20} className="animate-spin" />Starting Interview...</>
                ) : (
                  <><span>{resumeContext ? 'Start Personalized Interview' : 'Start Interview (Skip Resume)'}</span><ChevronRight size={20} /></>
                )}
              </motion.button>

              {!resumeContext && (
                <p className="text-center text-xs text-gray-500 mt-3">
                  You can skip this step — questions will still be high quality, just not personalized to your resume.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
}
