import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertCircle, Lightbulb,
  MessageSquare, TrendingUp, Heart, ChevronDown, ChevronUp, Home, FileDown, Loader2
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import ScoreGauge from '../components/ScoreGauge.jsx';
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../context/AuthContext';
import { exportInterviewPDF } from '../utils/exportPDF';



export default function FeedbackPage() {
  const navigate = useNavigate();
  const { lastFeedback, setLastFeedback } = useInterview();
  const { user } = useAuth();
  const [showSuggested, setShowSuggested] = useState(false);
  const [exportingPDF, setExportingPDF]   = useState(false);

  useEffect(() => {
    if (!lastFeedback) navigate('/dashboard', { replace: true });
  }, [lastFeedback, navigate]);

  if (!lastFeedback) return null;

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportInterviewPDF(lastFeedback, user?.name || 'Candidate');
    } finally {
      setExportingPDF(false);
    }
  };
  const overallScore = lastFeedback.finalScore || 0;
  
  const breakdown = [
    { label: 'Content Quality',  score: lastFeedback.scoreBreakdown?.content || 0, icon: MessageSquare, color: 'text-blue-400',  bg: 'bg-blue-500/10',  bar: 'bg-blue-400'  },
    { label: 'Communication',    score: lastFeedback.scoreBreakdown?.communication || 0, icon: TrendingUp,     color: 'text-green-400', bg: 'bg-green-500/10', bar: 'bg-green-400' },
    { label: 'Confidence',       score: lastFeedback.scoreBreakdown?.confidence || 0, icon: Heart,          color: 'text-pink-400',  bg: 'bg-pink-500/10',  bar: 'bg-pink-400'  },
  ];

  const strengths = lastFeedback.strengths || ['Good attempt'];
  const improvements = lastFeedback.improvements || ['Practice more'];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#0a0a0a]"
    >
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Top header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-semibold uppercase tracking-widest mb-4">
            ✓ Interview Complete
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">Your Performance Report</h1>
          <p className="text-gray-400 mt-2 text-sm">{lastFeedback.type} Interview · {lastFeedback.domain} · {new Date(lastFeedback.completedAt || Date.now()).toLocaleDateString()}</p>
        </motion.div>

        {/* Score + breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl border border-white/8 p-8 mb-6"
        >
          <div className="flex flex-col md:flex-row items-center gap-10">
            {/* Gauge */}
            <div className="flex flex-col items-center gap-3">
              <ScoreGauge score={overallScore} size={180} strokeWidth={12} />
              <div className="text-center">
                <p className="text-sm font-bold text-white">Overall Score</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {overallScore >= 80 ? '🏆 Excellent' : overallScore >= 60 ? '👍 Good' : '📈 Needs Work'}
                </p>
              </div>
            </div>

            {/* Score bars */}
            <div className="flex-1 w-full flex flex-col gap-5">
              {breakdown.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center`}>
                        <item.icon size={14} className={item.color} />
                      </div>
                      <span className="text-sm font-medium text-gray-200">{item.label}</span>
                    </div>
                    <span className="text-lg font-black text-white tabular-nums">{item.score}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/8">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.score}%` }}
                      transition={{ delay: 0.4 + i * 0.1, duration: 1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${item.bar}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Strengths & Improvements grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Strengths */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl border border-green-500/15 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
               <CheckCircle2 size={18} className="text-green-400" />
              <h2 className="text-base font-bold text-white">Strengths</h2>
            </div>
            <ul className="flex flex-col gap-2.5">
              {strengths.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="flex items-start gap-2.5 text-sm text-gray-300"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                  {s}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Improvements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl border border-orange-500/15 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={18} className="text-orange-400" />
              <h2 className="text-base font-bold text-white">Areas to Improve</h2>
            </div>
            <ul className="flex flex-col gap-2.5">
              {improvements.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.07 }}
                  className="flex items-start gap-2.5 text-sm text-gray-300"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                  {s}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Suggested Answer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl border border-gold-500/15 p-6 mb-8"
        >
          <button
            onClick={() => setShowSuggested(s => !s)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-gold-400" />
              <h2 className="text-base font-bold text-white">AI-Suggested Better Answers</h2>
            </div>
            {showSuggested ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

            {showSuggested && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 border-t border-white/5 pt-4 space-y-4"
              >
                {lastFeedback.qa?.filter(qa => qa.question && qa.answer).map((qa, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/10">
                     <p className="text-sm font-semibold text-white mb-2">Q: {qa.question}</p>
                    <p className="text-sm text-gray-400 mb-3"><span className="text-gray-500">Your Answer:</span> {qa.answer}</p>
                    <div className="bg-gold-500/10 border border-gold-500/20 p-3 rounded-lg">
                      <p className="text-sm text-gold-300"><span className="font-semibold text-gold-400">Better Answer:</span> {qa.suggestedAnswer || 'Detailed answer not generated.'}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center pb-12"
        >
          {/* Export PDF */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="btn-gold flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold shadow-gold-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportingPDF ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            {exportingPDF ? 'Generating...' : 'Download Report'}
          </motion.button>

          <button
            onClick={() => { setLastFeedback(null); navigate('/dashboard'); }}
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white text-sm font-semibold transition-all"
          >
            <Home size={16} />
            Dashboard
          </button>
        </motion.div>

      </main>
    </motion.div>
  );
}
