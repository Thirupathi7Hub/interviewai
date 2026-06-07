import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, Trophy, TrendingUp, ArrowRight, Calendar, Star,
  Upload, FileText, Sparkles, Trash2, Loader2, ChevronRight, X
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import client from '../api/client';

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

// ─── Resume-Based Interview Panel ─────────────────────────────────────────────
function ResumeInterviewPanel({ onClose }) {
  const navigate = useNavigate();
  const { startInterview } = useInterview();

  const [resumeCtx,  setResumeCtx]  = useState(null);
  const [fileName,   setFileName]   = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [starting,   setStarting]   = useState(false);
  const [error,      setError]      = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const fileRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') { setError('PDF files only.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('File too large — max 5 MB.'); return; }
    setError(''); setUploading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
      ).toString();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page    = await pdf.getPage(p);
        const content = await page.getTextContent();
        fullText += content.items.map(i => i.str).join(' ') + '\n';
      }
      if (!fullText.trim() || fullText.trim().length < 50) {
        setError('Could not extract text. Try a text-based (non-scanned) PDF.'); return;
      }
      const res = await client.post('/resume/parse', { text: fullText, fileName: file.name });
      setResumeCtx(res.data);
      setFileName(file.name);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to read PDF. Try another file.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, []);

  const handleStart = async () => {
    if (!resumeCtx || starting) return;
    setStarting(true);
    try {
      // Use "role" as type and candidate name as domain for resume-based
      await startInterview('Resume', resumeCtx.candidateName || 'General', 5, 'intermediate', resumeCtx);
      navigate('/session');
    } catch {
      setError('Failed to start interview. Please try again.');
      setStarting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.3 }}
      className="mt-4 rounded-3xl border border-purple-500/20 bg-purple-500/5 p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-white">Resume-Based Interview Setup</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {!resumeCtx ? (
        /* Upload zone */
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
            dragOver ? 'border-purple-500 bg-purple-500/10 scale-[1.01]' : 'border-white/10 hover:border-purple-500/40 hover:bg-white/3'
          }`}
        >
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => handleUpload(e.target.files[0])} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={36} className="text-purple-400 animate-spin" />
              <p className="text-white font-semibold text-sm">Reading your resume...</p>
              <p className="text-gray-500 text-xs">Extracting skills & experience</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Upload size={24} className="text-purple-400" />
              </div>
              <div>
                <p className="text-white font-bold">Drop your resume PDF here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse · PDF only · Max 5 MB</p>
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm mt-3 font-medium">{error}</p>}
        </div>
      ) : (
        /* Resume parsed — show preview + start */
        <div>
          {/* File info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <FileText size={18} className="text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">{resumeCtx.candidateName}</p>
                <p className="text-gray-400 text-xs">{fileName} · {resumeCtx.skills?.length || 0} skills found</p>
              </div>
            </div>
            <button onClick={() => { setResumeCtx(null); setFileName(''); }}
              className="text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>

          {/* Skills */}
          {resumeCtx.skills?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detected Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {resumeCtx.skills.map(s => (
                  <span key={s} className="text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full capitalize">{s}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-green-400 font-semibold mb-5">
            <Sparkles size={12} /> Questions will be fully tailored to your background
          </div>

          {error && <p className="text-red-400 text-sm mb-3 font-medium">{error}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleStart} disabled={starting}
            className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white' }}
          >
            {starting
              ? <><Loader2 size={16} className="animate-spin" /> Starting...</>
              : <><Sparkles size={16} /> Start Personalised Interview <ChevronRight size={16} /></>
            }
          </motion.button>
          <p className="text-xs text-gray-500 text-center mt-2">Your resume is used only for this session — not stored</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { history, historyStats, fetchHistory } = useInterview();
  const [showResumePanel, setShowResumePanel] = useState(false);

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

        {/* ── Two Mode Cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10"
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
                onClick={() => { setShowResumePanel(false); navigate('/select'); }}
                className="btn-gold px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2"
              >
                Start Interview <ArrowRight size={16} />
              </motion.button>
            </div>
          </div>

          {/* Card 2 — Resume-Based */}
          <div
            className={`relative overflow-hidden rounded-3xl border p-7 transition-all duration-300 ${
              showResumePanel ? 'border-purple-500/40' : 'border-purple-500/20'
            }`}
            style={{ background: showResumePanel
              ? 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(147,51,234,0.06) 100%)'
              : 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(147,51,234,0.03) 100%)'
            }}
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
                onClick={() => setShowResumePanel(v => !v)}
                className="px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #9333ea)', color: 'white' }}
              >
                <Upload size={15} /> Upload Resume & Start
              </motion.button>
            </div>

            {/* Inline resume panel */}
            <AnimatePresence>
              {showResumePanel && (
                <ResumeInterviewPanel onClose={() => setShowResumePanel(false)} />
              )}
            </AnimatePresence>
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
