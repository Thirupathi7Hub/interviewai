import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronRight, ChevronLeft, Clock, Target, CheckCircle2,
  XCircle, AlertCircle, Trophy, BookOpen, Zap, BarChart3
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import client from '../api/client';

const DIFF_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };
const DIFF_COLORS = {
  beginner:     { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  intermediate: { text: 'text-gold-400',   bg: 'bg-gold-500/10',   border: 'border-gold-500/20'   },
  expert:       { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
};
const OPT_LETTERS = ['A', 'B', 'C', 'D'];

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const running = useRef(false);
  useEffect(() => {
    running.current = true;
    const id = setInterval(() => { if (running.current) setSeconds(s => s + 1); }, 1000);
    return () => { running.current = false; clearInterval(id); };
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return { display: `${mm}:${ss}`, totalSeconds: seconds };
}

// ─── Loading Screen ────────────────────────────────────────────────────────────
function LoadingScreen({ difficulty, count }) {
  const dc = DIFF_COLORS[difficulty] || DIFF_COLORS.intermediate;
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-8">
      <motion.div
        animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500"
      />
      <div className="text-center">
        <p className="text-white font-black text-2xl mb-2">Generating Questions…</p>
        <p className="text-gray-400 text-sm">
          AI is preparing <span className="text-white font-bold">{count}</span> {' '}
          <span className={`font-bold ${dc.text}`}>{DIFF_LABELS[difficulty]}</span> aptitude questions for you
        </p>
      </div>
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <motion.div key={i} animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
            className="w-2.5 h-2.5 rounded-full bg-purple-500" />
        ))}
      </div>
    </div>
  );
}

// ─── Result Page ───────────────────────────────────────────────────────────────
function ResultsPage({ questions, answers, difficulty, timeTaken }) {
  const navigate = useNavigate();
  const correct = answers.filter((a, i) => a === questions[i].correct).length;
  const total   = questions.length;
  const score   = Math.round((correct / total) * 100);
  const dc      = DIFF_COLORS[difficulty] || DIFF_COLORS.intermediate;

  const grade = score >= 90 ? { label: '🏆 Outstanding!', color: 'text-green-400' }
              : score >= 75 ? { label: '🌟 Excellent!',   color: 'text-gold-400'  }
              : score >= 60 ? { label: '👍 Good Job!',     color: 'text-blue-400'  }
              : score >= 40 ? { label: '📈 Keep Going!',   color: 'text-orange-400' }
              :               { label: '💪 Practice More', color: 'text-red-400'   };

  const mm = String(Math.floor(timeTaken / 60)).padStart(2, '0');
  const ss = String(timeTaken % 60).padStart(2, '0');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-widest mb-4">
            🧠 Aptitude Master · Results
          </div>
          <h1 className={`text-4xl font-black mb-2 ${grade.color}`}>{grade.label}</h1>
          <p className="text-gray-400 text-sm">
            <span className={`font-semibold ${dc.text}`}>{DIFF_LABELS[difficulty]}</span>
            {' '}· {total} Questions · Time: {mm}:{ss}
          </p>
        </motion.div>

        {/* Score Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-3xl border border-white/8 p-8 mb-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-4xl font-black text-white mb-1">{score}%</p>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Score</p>
            </div>
            <div>
              <p className="text-4xl font-black text-green-400 mb-1">{correct}</p>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Correct</p>
            </div>
            <div>
              <p className="text-4xl font-black text-red-400 mb-1">{total - correct}</p>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Wrong</p>
            </div>
          </div>

          {/* Score Bar */}
          <div className="mt-6 w-full h-3 rounded-full bg-white/5">
            <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }}
              transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                score >= 75 ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : score >= 50 ? 'bg-gradient-to-r from-gold-500 to-yellow-400'
                : 'bg-gradient-to-r from-red-500 to-red-400'
              }`} />
          </div>
        </motion.div>

        {/* Q&A Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }} className="space-y-4 mb-8">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <BookOpen size={18} className="text-purple-400" /> Answer Review
          </h2>
          {questions.map((q, i) => {
            const selected = answers[i];
            const isCorrect = selected === q.correct;
            const skipped   = selected === null;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                className={`glass rounded-2xl border p-5 ${
                  isCorrect ? 'border-green-500/20' : skipped ? 'border-white/8' : 'border-red-500/20'
                }`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {isCorrect ? <CheckCircle2 size={18} className="text-green-400" />
                     : skipped  ? <AlertCircle  size={18} className="text-gray-500" />
                     :            <XCircle      size={18} className="text-red-400" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Q{i + 1}</span>
                    <span className="text-white font-medium text-sm">{q.question}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 ml-7">
                  {OPT_LETTERS.map(letter => {
                    const isRight = letter === q.correct;
                    const isPicked = letter === selected;
                    return (
                      <div key={letter} className={`text-xs px-3 py-2 rounded-xl font-medium transition-all ${
                        isRight  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : isPicked && !isRight ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-white/3 text-gray-500 border border-white/5'
                      }`}>
                        <span className="font-bold mr-2">{letter}.</span>{q.options[letter]}
                      </div>
                    );
                  })}
                </div>

                {q.explanation && (
                  <div className="ml-7 flex items-start gap-2 text-xs text-gray-400 bg-white/3 rounded-xl px-3 py-2">
                    <Zap size={12} className="text-gold-400 mt-0.5 flex-shrink-0" />
                    <span>{q.explanation}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-2xl text-sm font-bold border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition-all">
            Back to Dashboard
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/aptitude')}
            className="px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white' }}>
            <Trophy size={15} /> Try Again
          </motion.button>
        </div>
      </main>
    </motion.div>
  );
}

// ─── Main Aptitude Session Page ────────────────────────────────────────────────
export default function AptitudeSessionPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const timer     = useTimer();

  // Params passed via router state from DashboardPage
  const { difficulty = 'intermediate', count = 10 } = location.state || {};

  const [questions,  setQuestions]  = useState([]);
  const [answers,    setAnswers]    = useState([]); // null = skipped
  const [current,    setCurrent]    = useState(0);
  const [selected,   setSelected]   = useState(null); // current question pick
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [finished,   setFinished]   = useState(false);
  const [finalTime,  setFinalTime]  = useState(0);
  const [revealed,   setRevealed]   = useState(false); // show answer after pick

  // Fetch questions
  useEffect(() => {
    (async () => {
      try {
        const res = await client.post('/aptitude/generate', { count, difficulty });
        setQuestions(res.data.questions);
        setAnswers(new Array(res.data.questions.length).fill(null));
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load questions. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [count, difficulty]);

  const handleSelect = useCallback((letter) => {
    if (revealed) return; // already answered
    setSelected(letter);
    setRevealed(true);
    setAnswers(prev => {
      const copy = [...prev];
      copy[current] = letter;
      return copy;
    });
  }, [current, revealed]);

  const handleNext = useCallback(() => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(answers[current + 1]); // restore if revisiting
      setRevealed(answers[current + 1] !== null);
    } else {
      setFinalTime(timer.totalSeconds);
      setFinished(true);
    }
  }, [current, questions.length, answers, timer.totalSeconds]);

  const handlePrev = useCallback(() => {
    if (current > 0) {
      setCurrent(c => c - 1);
      setSelected(answers[current - 1]);
      setRevealed(answers[current - 1] !== null);
    }
  }, [current, answers]);

  const handleSkip = useCallback(() => {
    setAnswers(prev => { const c = [...prev]; c[current] = null; return c; });
    handleNext();
  }, [current, handleNext]);

  if (loading) return <LoadingScreen difficulty={difficulty} count={count} />;

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4 text-lg font-semibold">{error}</p>
        <button onClick={() => navigate('/dashboard')}
          className="btn-gold px-6 py-3 rounded-xl text-sm font-bold">Back to Dashboard</button>
      </div>
    </div>
  );

  if (finished) return (
    <ResultsPage questions={questions} answers={answers}
      difficulty={difficulty} timeTaken={finalTime} />
  );

  if (!questions.length) return null;

  const q       = questions[current];
  const dc      = DIFF_COLORS[difficulty] || DIFF_COLORS.intermediate;
  const answered = answers.filter(a => a !== null).length;
  const progress = ((current) / questions.length) * 100;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#0a0a0a]">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${dc.text} ${dc.bg} ${dc.border}`}>
              🧠 Aptitude Master
            </div>
            <div className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${dc.text} ${dc.bg} ${dc.border}`}>
              {DIFF_LABELS[difficulty]}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-gray-400">
              <BarChart3 size={14} />
              <span className="font-bold text-white">{answered}</span>
              <span>/ {questions.length} answered</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock size={14} />
              <span className="font-mono font-bold text-white">{timer.display}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-white/5 mb-8">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500"
          />
        </div>

        {/* Question Dots */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {questions.map((_, i) => (
            <button key={i} onClick={() => {
              setCurrent(i);
              setSelected(answers[i]);
              setRevealed(answers[i] !== null);
            }}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                i === current  ? 'bg-purple-500 text-white scale-110'
                : answers[i]  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/5 text-gray-500 border border-white/5 hover:border-purple-500/30'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div key={current}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
            className="glass rounded-3xl border border-white/8 p-8 mb-6">

            {/* Q Counter + Question */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                  Question {current + 1} of {questions.length}
                </span>
              </div>
              <h2 className="text-white font-bold text-lg leading-relaxed">{q.question}</h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {OPT_LETTERS.map(letter => {
                const isCorrect = letter === q.correct;
                const isPicked  = letter === selected;

                let cls = 'bg-white/3 border-white/8 text-gray-200 hover:border-purple-500/40 hover:bg-purple-500/5 cursor-pointer';
                if (revealed) {
                  if (isCorrect)              cls = 'bg-green-500/15 border-green-500/40 text-green-300 cursor-default';
                  else if (isPicked)          cls = 'bg-red-500/15 border-red-500/40 text-red-300 cursor-default';
                  else                        cls = 'bg-white/2 border-white/5 text-gray-500 cursor-default';
                }

                return (
                  <motion.button key={letter}
                    whileHover={!revealed ? { scale: 1.01 } : {}}
                    whileTap={!revealed ? { scale: 0.99 } : {}}
                    onClick={() => handleSelect(letter)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 text-left ${cls}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      revealed && isCorrect ? 'bg-green-500 text-white'
                      : revealed && isPicked ? 'bg-red-500 text-white'
                      : 'bg-white/5 text-gray-400'
                    }`}>
                      {revealed && isCorrect ? <CheckCircle2 size={14} />
                       : revealed && isPicked && !isCorrect ? <XCircle size={14} />
                       : letter}
                    </div>
                    <span className="font-medium text-sm">{q.options[letter]}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation (shown after answering) */}
            <AnimatePresence>
              {revealed && q.explanation && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ delay: 0.2 }}
                  className="mt-5 flex items-start gap-2 bg-white/3 rounded-2xl px-4 py-3 border border-white/5">
                  <Zap size={14} className="text-gold-400 mt-0.5 flex-shrink-0" />
                  <p className="text-gray-300 text-sm">{q.explanation}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={handlePrev} disabled={current === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-gray-400 border border-white/8 hover:border-white/20 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={16} /> Previous
          </motion.button>

          <div className="flex items-center gap-3">
            {!revealed && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleSkip}
                className="px-5 py-3 rounded-2xl text-sm font-bold text-gray-400 border border-white/8 hover:border-white/20 transition-all">
                Skip
              </motion.button>
            )}

            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white' }}>
              {current === questions.length - 1 ? (
                <><Trophy size={15} /> Finish &amp; See Results</>
              ) : (
                <>Next <ChevronRight size={16} /></>
              )}
            </motion.button>
          </div>
        </div>

        {/* Finish Early */}
        {current < questions.length - 1 && answered >= Math.ceil(questions.length * 0.5) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-center mt-6">
            <button onClick={() => { setFinalTime(timer.totalSeconds); setFinished(true); }}
              className="text-gray-500 text-xs hover:text-gray-300 transition-colors underline underline-offset-2">
              Submit early ({answered}/{questions.length} answered)
            </button>
          </motion.div>
        )}

      </main>
    </motion.div>
  );
}
