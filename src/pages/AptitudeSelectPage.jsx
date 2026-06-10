import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Zap, ArrowLeft, ChevronRight,
  Target, BookOpen, BarChart3, Clock
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';

const STEPS = ['Difficulty', 'Questions'];

const difficulties = [
  {
    id: 'beginner',
    label: 'Beginner',
    emoji: '🌱',
    color: '#10b981',
    badge: 'Freshers & Starters',
    desc: 'Easy arithmetic, simple patterns & basic vocabulary',
    detail: 'Percentages, simple series, odd-one-out, basic analogies',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    emoji: '⚡',
    color: '#f59e0b',
    badge: 'Most popular',
    desc: 'Word problems, logical reasoning & data interpretation',
    detail: 'Profit & loss, work-time, number series, coding-decoding',
  },
  {
    id: 'expert',
    label: 'Expert',
    emoji: '🔥',
    color: '#ef4444',
    badge: 'Campus Placement Ready',
    desc: 'Complex multi-step problems & abstract reasoning',
    detail: 'Advanced puzzles, mixed DI, tricky probability, verbal logic',
  },
];

const questionCounts = [
  { id: 5,  label: '5',  sub: 'Quick Warm-up',   time: '~5 min',  color: '#10b981' },
  { id: 10, label: '10', sub: 'Standard Quiz',    time: '~12 min', color: '#f59e0b' },
  { id: 20, label: '20', sub: 'Full Assessment',  time: '~25 min', color: '#ef4444' },
];

const topics = [
  { label: 'Quantitative Aptitude', emoji: '🔢', desc: 'Numbers, percentages, speed, work' },
  { label: 'Logical Reasoning',     emoji: '🧩', desc: 'Patterns, puzzles, sequences' },
  { label: 'Verbal Ability',        emoji: '📝', desc: 'Analogies, vocab, comprehension' },
  { label: 'Data Interpretation',   emoji: '📊', desc: 'Tables, charts, graphs' },
];

function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-10">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            i === current
              ? 'bg-teal-500/15 border border-teal-500/40 text-teal-300'
              : i < current
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-white/5 border border-white/8 text-gray-500'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
              i < current ? 'bg-green-500 text-white'
              : i === current ? 'bg-teal-500 text-white'
              : 'bg-white/5 text-gray-600'
            }`}>
              {i < current ? '✓' : i + 1}
            </span>
            {step}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${i < current ? 'bg-green-500/40' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function AptitudeSelectPage() {
  const navigate = useNavigate();
  const [step,       setStep]       = useState(0); // 0=difficulty, 1=count
  const [difficulty, setDifficulty] = useState(null);
  const [count,      setCount]      = useState(null);

  const selectedDiff = difficulties.find(d => d.id === difficulty);

  const handleStart = () => {
    navigate('/aptitude', { state: { difficulty, count } });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#0a0a0a]"
    >
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          onClick={() => step === 0 ? navigate('/dashboard') : setStep(s => s - 1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          {step === 0 ? 'Back to Dashboard' : 'Back'}
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-widest mb-4">
            <Brain size={12} /> Aptitude Master
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
            Configure Your Quiz
          </h1>
          <p className="text-gray-400 text-sm">
            AI-generated MCQ covering Quantitative · Logical · Verbal · Data topics
          </p>

          {/* Topic Pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {topics.map(t => (
              <span key={t.label}
                className="text-xs font-medium text-teal-400/80 bg-teal-500/8 border border-teal-500/15 px-3 py-1 rounded-full">
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Step Indicator */}
        <StepIndicator steps={STEPS} current={step} />

        {/* ── STEP 0: Difficulty ── */}
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step-0"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}
            >
              <h2 className="text-lg font-bold text-white text-center mb-6">
                Select Difficulty Level
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {difficulties.map((d, i) => (
                  <motion.button
                    key={d.id}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDifficulty(d.id)}
                    className={`relative text-left p-6 rounded-3xl border-2 transition-all duration-200 ${
                      difficulty === d.id
                        ? 'border-opacity-80 shadow-lg'
                        : 'border-white/8 bg-white/2 hover:border-white/15'
                    }`}
                    style={difficulty === d.id ? {
                      borderColor: d.color + '80',
                      background: `linear-gradient(135deg, ${d.color}12, ${d.color}05)`,
                    } : {}}
                  >
                    {/* Badge */}
                    <div className="absolute top-4 right-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: d.color + '20', color: d.color }}>
                        {d.badge}
                      </span>
                    </div>

                    <div className="text-3xl mb-3">{d.emoji}</div>
                    <h3 className="text-white font-black text-xl mb-1">{d.label}</h3>
                    <p className="text-gray-400 text-sm mb-3">{d.desc}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{d.detail}</p>

                    {difficulty === d.id && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute bottom-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black"
                        style={{ background: d.color }}>
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => difficulty && setStep(1)}
                  disabled={!difficulty}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: 'white' }}
                >
                  Next: Choose Questions <ChevronRight size={16} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 1: Question Count ── */}
          {step === 1 && (
            <motion.div key="step-1"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}
            >
              {/* Selected difficulty recap */}
              {selectedDiff && (
                <div className="flex items-center justify-center gap-3 mb-8">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full border"
                    style={{ borderColor: selectedDiff.color + '40', background: selectedDiff.color + '12' }}>
                    <span className="text-lg">{selectedDiff.emoji}</span>
                    <span className="font-bold text-sm" style={{ color: selectedDiff.color }}>
                      {selectedDiff.label}
                    </span>
                    <span className="text-gray-400 text-sm">difficulty selected</span>
                  </div>
                </div>
              )}

              <h2 className="text-lg font-bold text-white text-center mb-6">
                How Many Questions?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {questionCounts.map((qc, i) => (
                  <motion.button
                    key={qc.id}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCount(qc.id)}
                    className={`relative text-center p-8 rounded-3xl border-2 transition-all duration-200 ${
                      count === qc.id
                        ? 'shadow-lg'
                        : 'border-white/8 bg-white/2 hover:border-white/15'
                    }`}
                    style={count === qc.id ? {
                      borderColor: qc.color + '80',
                      background: `linear-gradient(135deg, ${qc.color}12, ${qc.color}05)`,
                    } : {}}
                  >
                    <p className="text-6xl font-black mb-2"
                      style={{ color: count === qc.id ? qc.color : 'white' }}>
                      {qc.label}
                    </p>
                    <p className="text-white font-bold text-sm mb-1">{qc.sub}</p>
                    <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs">
                      <Clock size={12} /> {qc.time}
                    </div>

                    {count === qc.id && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black"
                        style={{ background: qc.color }}>
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Summary */}
              {count && selectedDiff && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-2xl border border-teal-500/20 p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Target size={15} className="text-teal-400" />
                      <span className="text-gray-400">Difficulty:</span>
                      <span className="text-white font-bold">{selectedDiff.emoji} {selectedDiff.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen size={15} className="text-teal-400" />
                      <span className="text-gray-400">Questions:</span>
                      <span className="text-white font-bold">{count} MCQs</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <BarChart3 size={15} className="text-teal-400" />
                      <span className="text-gray-400">Topics:</span>
                      <span className="text-white font-bold">Random Mix</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={handleStart}
                  disabled={!count}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: 'white' }}
                >
                  <Zap size={16} /> Start Quiz — {count} Questions
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </motion.div>
  );
}
