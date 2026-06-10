import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, Trophy, TrendingUp, ArrowRight, Calendar, Star,
  Upload, Sparkles, Brain, CheckSquare
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';

const badgeColor = {
  Outstanding: 'text-green-400 bg-green-500/10 border-green-500/20',
  Excellent:   'text-gold-400 bg-gold-500/10 border-gold-500/20',
  Good:        'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Average:     'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-gold-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-sm font-bold text-white tabular-nums">{score}</span>
    </div>
  );
}


// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { history, historyStats, fetchHistory } = useInterview();

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const userName = user?.name?.split(' ')[0] || 'User';
  const getBadge = (score) => {
    if (score >= 90) return 'Outstanding';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Average';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#0a0a0a]"
    >
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }} className="mb-10"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Welcome back, {userName}&nbsp;👋
          </h1>
          <p className="text-gray-400 mt-2 text-base">
            Choose your interview mode below and start practising.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard icon={BarChart2}  label="Total Interviews" value={historyStats?.total     || 0} sub="Keep it up!" color="gold"  index={0} />
          <StatCard icon={TrendingUp} label="Average Score"    value={historyStats?.avgScore  || 0} sub="Out of 100"  color="blue"  index={1} />
          <StatCard icon={Trophy}     label="Best Performance" value={historyStats?.bestScore || 0} sub="Top Score"   color="green" index={2} />
        </div>

        {/* ── Three Mode Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10"
        >
          {/* Card 1 — Regular Interview */}
          <div className="relative overflow-hidden rounded-3xl border border-gold-500/20 p-7"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(180,83,9,0.04) 100%)' }}>
            <div className="absolute right-0 top-0 w-48 h-48 opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 80% 20%, #f59e0b, transparent)' }} />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gold-500/15 border border-gold-500/20 flex items-center justify-center mb-4 text-2xl">
                🎯
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Star size={12} className="text-gold-400" fill="#f59e0b" />
                <span className="text-xs font-semibold text-gold-400 uppercase tracking-widest">Classic Mode</span>
              </div>
              <h2 className="text-xl font-black text-white mb-1.5">Subject / Role Interview</h2>
              <p className="text-gray-400 text-sm mb-6">
                Pick a programming language or job role. Questions cover the full skill set for your chosen topic.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/select')}
                className="btn-gold px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
              >
                Start Interview <ArrowRight size={16} />
              </motion.button>
            </div>
          </div>

          {/* Card 2 — Resume-Based */}
          <div
            className="relative overflow-hidden rounded-3xl border border-purple-500/20 p-7"
            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(147,51,234,0.03) 100%)' }}
          >
            <div className="absolute right-0 top-0 w-48 h-48 opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 80% 20%, #7c3aed, transparent)' }} />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center mb-4 text-2xl">
                📄
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={12} className="text-purple-400" />
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">AI Personalised</span>
              </div>
              <h2 className="text-xl font-black text-white mb-1.5">Resume-Based Interview</h2>
              <p className="text-gray-400 text-sm mb-6">
                Upload your resume PDF. The AI reads your skills and experience, then asks questions tailored specifically to <em>you</em>.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/resume/upload')}
                className="px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white' }}
              >
                <Upload size={15} /> Upload Resume &amp; Start
              </motion.button>
            </div>
          </div>

          {/* Card 3 — Aptitude Master */}
          <div
            className="relative overflow-hidden rounded-3xl border border-teal-500/20 p-7"
            style={{ background: 'linear-gradient(135deg, rgba(13,148,136,0.07) 0%, rgba(8,145,178,0.03) 100%)' }}
          >
            <div className="absolute right-0 top-0 w-48 h-48 opacity-10 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 80% 20%, #0d9488, transparent)' }} />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center mb-4 text-2xl">
                🧠
              </div>
              <div className="flex items-center gap-2 mb-1">
                <CheckSquare size={12} className="text-teal-400" />
                <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">MCQ Quiz</span>
              </div>
              <h2 className="text-xl font-black text-white mb-1.5">Aptitude Master</h2>
              <p className="text-gray-400 text-sm mb-6">
                AI-generated MCQ quiz covering Quantitative, Logical, Verbal &amp; Data topics. No camera — pure assessment.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/aptitude/select')}
                className="px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: 'white' }}
              >
                <Brain size={15} /> Start Aptitude Quiz <ArrowRight size={16} />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Recent Interviews */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.45 }}
        >
          <div className="mb-5">
            <h2 className="text-lg font-bold text-white">Recent Interviews</h2>
          </div>

          <div className="glass rounded-2xl border border-white/8 overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-white/5 items-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Badge</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider opacity-0 select-none">Action</p>
            </div>

            {history.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500 text-sm">
                No interviews completed yet. Start a new session above!
              </div>
            ) : (
              history.map((item, i) => {
                const badge = getBadge(item.finalScore);
                return (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.07 }}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr_1fr_auto] gap-3 sm:gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors group cursor-pointer items-center"
                    onClick={() => navigate(`/feedback/${item._id}`)}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar size={13} className="opacity-60" />
                      {new Date(item.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-sm font-medium text-white">{item.type} – {item.domain}</div>
                    <div><ScoreBar score={item.finalScore} /></div>
                    <div className="flex items-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeColor[badge]}`}>
                        {badge}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center justify-end gap-1 text-xs text-gray-600 group-hover:text-gold-400 transition-colors whitespace-nowrap">
                      View Report <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>

      </main>
    </motion.div>
  );
}
