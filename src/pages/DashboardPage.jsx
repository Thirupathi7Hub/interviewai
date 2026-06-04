import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, Trophy, Target, ArrowRight,
  Calendar, TrendingUp, Clock, Star
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';



const badgeColor = {
  Outstanding:  'text-green-400 bg-green-500/10 border-green-500/20',
  Excellent:    'text-gold-400 bg-gold-500/10 border-gold-500/20',
  Good:         'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Average:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-gold-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-sm font-bold text-white tabular-nums">{score}</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { history, historyStats, fetchHistory } = useInterview();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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
          transition={{ duration: 0.45 }}
          className="mb-10"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Welcome back, {userName}&nbsp;👋
          </h1>
          <p className="text-gray-400 mt-2 text-base">
            You're on a roll! Let's crush another interview today.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard icon={BarChart2} label="Total Interviews" value={historyStats?.total || 0}   sub="Keep it up!"        color="gold"  index={0} />
          <StatCard icon={TrendingUp} label="Average Score"  value={historyStats?.avgScore || 0} sub="Out of 100"  color="blue"  index={1} />
          <StatCard icon={Trophy}    label="Best Performance" value={historyStats?.bestScore || 0}  sub="Top Score"    color="green" index={2} />
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl p-8 sm:p-10 mb-10 border border-gold-500/20"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(180,83,9,0.04) 100%)' }}
        >
          {/* Decorative */}
          <div className="absolute right-0 top-0 w-64 h-64 opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 80% 20%, #f59e0b, transparent)' }} />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star size={14} className="text-gold-400" fill="#f59e0b" />
                <span className="text-xs font-semibold text-gold-400 uppercase tracking-widest">Ready to practice?</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">Start a New Interview</h2>
              <p className="text-gray-400 mt-1.5 text-sm max-w-md">
                Choose from Technical, HR, or subject-based Viva sessions tailored to your domain.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/select')}
              className="btn-gold flex-shrink-0 px-8 py-4 rounded-2xl text-base font-bold flex items-center gap-2 shadow-gold-md"
            >
              Start Now
              <ArrowRight size={18} />
            </motion.button>
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
            {/* Header */}
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
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
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
                      View Report
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
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
