import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, AlertCircle, Lightbulb,
  MessageSquare, TrendingUp, Heart, ChevronDown, ChevronUp,
  Home, FileDown, Loader2, ArrowLeft, RefreshCw
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import ScoreGauge from '../components/ScoreGauge.jsx';
import { useInterview } from '../context/InterviewContext';
import { useAuth } from '../context/AuthContext';
import { exportInterviewPDF } from '../utils/exportPDF';
import client from '../api/client';

export default function FeedbackPage() {
  const navigate  = useNavigate();
  const { id }    = useParams();                          // present on /feedback/:id
  const { lastFeedback, setLastFeedback } = useInterview();
  const { user }  = useAuth();

  const [feedback,     setFeedback]     = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [showSuggested, setShowSuggested] = useState(false);
  const [exportingPDF,  setExportingPDF]  = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      // Permalink mode: fetch full report from DB
      setLoading(true);
      client.get(`/interview/${id}`)
        .then(res => setFeedback(res.data))
        .catch(() => setError('Could not load this report. It may have been deleted.'))
        .finally(() => setLoading(false));
    } else if (lastFeedback) {
      // Post-interview mode: use in-memory context data
      setFeedback(lastFeedback);
    } else {
      // Nothing available — redirect
      navigate('/dashboard', { replace: true });
    }
  }, [id, lastFeedback, navigate]);

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportInterviewPDF(feedback, user?.name || 'Candidate');
    } finally {
      setExportingPDF(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Loading your report...</p>
      </div>
    </div>
  );

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-gold px-6 py-3 rounded-xl text-sm font-bold">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  if (!feedback) return null;

  const overallScore  = feedback.finalScore || 0;
  const strengths     = feedback.strengths    || ['Good attempt'];
  const improvements  = feedback.improvements || ['Practice more'];

  const breakdown = [
    { label: 'Content Quality', score: feedback.scoreBreakdown?.content       || 0, icon: MessageSquare, color: 'text-blue-400',  bg: 'bg-blue-500/10',  bar: 'bg-blue-400'  },
    { label: 'Communication',   score: feedback.scoreBreakdown?.communication  || 0, icon: TrendingUp,    color: 'text-green-400', bg: 'bg-green-500/10', bar: 'bg-green-400' },
    { label: 'Confidence',      score: feedback.scoreBreakdown?.confidence     || 0, icon: Heart,         color: 'text-pink-400',  bg: 'bg-pink-500/10',  bar: 'bg-pink-400'  },
  ];

  const answeredQA = (feedback.qa || []).filter(q => q.question && q.answer);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#0a0a0a]"
    >
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </motion.button>

        {/* Top header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-semibold uppercase tracking-widest mb-4">
            ✓ Interview Report
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            {feedback.type === 'Resume'
              ? `${user?.name || feedback.resumeContext?.candidateName || 'Candidate'}'s Resume Interview Report`
              : 'Your Performance Report'}
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            {feedback.type === 'Resume' ? 'Resume-Based' : feedback.type} Interview &middot; {feedback.type === 'Resume' ? 'AI Personalised' : feedback.domain} &middot;{' '}
            {new Date(feedback.completedAt || Date.now()).toLocaleDateString(undefined, {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </motion.div>

        {/* Score + breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl border border-white/8 p-8 mb-6"
        >
          <div className={`flex flex-col md:flex-row items-center gap-10 ${feedback.type === 'Aptitude' ? 'justify-center' : ''}`}>
            <div className="flex flex-col items-center gap-3">
              <ScoreGauge score={overallScore} size={180} strokeWidth={12} />
              <div className="text-center">
                <p className="text-sm font-bold text-white">Overall Score</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {overallScore >= 80 ? '🏆 Excellent' : overallScore >= 60 ? '👍 Good' : '📈 Needs Work'}
                </p>
              </div>
            </div>

            {/* Only show Content/Communication/Confidence bars for non-Aptitude types */}
            {feedback.type !== 'Aptitude' && (
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
            )}
          </div>
        </motion.div>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="flex items-start gap-2.5 text-sm text-gray-300"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                  {s}
                </motion.li>
              ))}
            </ul>
          </motion.div>

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
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
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

        {/* Q&A with Suggested Answers */}
        {answeredQA.length > 0 && (
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
                <h2 className="text-base font-bold text-white">
                  AI-Suggested Better Answers
                  <span className="ml-2 text-xs font-normal text-gray-500">({answeredQA.length} questions)</span>
                </h2>
              </div>
              {showSuggested ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            <AnimatePresence>
              {showSuggested && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 border-t border-white/5 pt-4 space-y-4 overflow-hidden"
                >
                  {answeredQA.map((qa, idx) => (
                    <div key={idx} className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">Q{idx + 1}: {qa.question}</p>
                        {qa.score !== undefined && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            qa.score >= 75 ? 'bg-green-500/15 text-green-400' :
                            qa.score >= 50 ? 'bg-yellow-500/15 text-yellow-400' :
                            'bg-red-500/15 text-red-400'
                          }`}>
                            {qa.score}/100
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3">
                        <span className="text-gray-500">Your Answer: </span>{qa.answer}
                      </p>
                      {qa.suggestedAnswer && (
                        <div className="bg-gold-500/10 border border-gold-500/20 p-3 rounded-lg">
                          <p className="text-sm text-gold-300">
                            <span className="font-semibold text-gold-400">Better Answer: </span>
                            {qa.suggestedAnswer}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center pb-12"
        >
          {/* Hide PDF export for Aptitude quizzes */}
          {feedback.type !== 'Aptitude' && (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="btn-gold flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold shadow-gold-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingPDF ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              {exportingPDF ? 'Generating...' : 'Download PDF Report'}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/select')}
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl border border-gold-500/30 hover:bg-gold-500/5 text-gold-400 hover:text-gold-300 text-sm font-semibold transition-all"
          >
            <RefreshCw size={16} />
            Try Again
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
