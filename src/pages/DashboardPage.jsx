import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, Trophy, TrendingUp, ArrowRight,
  Calendar, Star, Upload, FileText, Sparkles, Trash2, Loader2, CheckCircle2
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

// ─── Resume Card ──────────────────────────────────────────────────────────────
function ResumeCard({ user }) {
  const [resumeCtx,     setResumeCtx]     = useState(user?.resumeContext || null);
  const [uploading,     setUploading]     = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState('');
  const [dragOver,      setDragOver]      = useState(false);
  const [justSaved,     setJustSaved]     = useState(false);
  const fileInputRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') { setError('PDF files only.'); return; }
    if (file.size > 5 * 1024 * 1024)              { setError('File too large — max 5 MB.'); return; }
    setError(''); setUploading(true);
    try {
      // 1. Extract text from PDF in browser using pdfjs-dist
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
        setError('Could not extract text. Try a non-scanned PDF.'); return;
      }
      // 2. Parse structured data
      const parseRes = await client.post('/resume/parse', { text: fullText, fileName: file.name });
      const parsed   = parseRes.data;
      // 3. Save to user profile
      await client.put('/user/resume', { resumeContext: parsed });
      setResumeCtx(parsed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse resume. Try another PDF.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await client.delete('/user/resume');
      setResumeCtx(null);
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.45 }}
      className="mb-10"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText size={18} className="text-gold-400" /> My Resume
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Upload once — all future interviews use it automatically</p>
        </div>
        {resumeCtx && (
          <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Sparkles size={11} /> Active
          </span>
        )}
      </div>

      {resumeCtx ? (
        /* ── Resume Loaded ── */
        <div className="glass rounded-2xl border border-green-500/20 p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <FileText size={22} className="text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold">{resumeCtx.candidateName}</p>
                <p className="text-gray-400 text-xs">{resumeCtx.fileName} · {resumeCtx.skills?.length || 0} skills detected</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {justSaved && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-green-400 flex items-center gap-1"
                >
                  <CheckCircle2 size={13} /> Saved!
                </motion.span>
              )}
              <button
                onClick={handleDelete} disabled={deleting}
                className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          </div>

          {resumeCtx.skills?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detected Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {resumeCtx.skills.map(s => (
                  <span key={s} className="text-xs font-medium text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2.5 py-1 rounded-full capitalize">{s}</span>
                ))}
              </div>
            </div>
          )}

          {resumeCtx.experienceLines?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Experience</p>
              <div className="space-y-1">
                {resumeCtx.experienceLines.slice(0, 2).map((l, i) => (
                  <p key={i} className="text-xs text-gray-400 truncate">• {l}</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-white/5">
            <label className="text-xs text-gray-500 hover:text-gold-400 cursor-pointer transition-colors flex items-center gap-1.5">
              <Upload size={12} /> Replace resume
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={e => handleUpload(e.target.files[0])} />
            </label>
          </div>
        </div>
      ) : (
        /* ── Upload Zone ── */
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
          className={`glass rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
            dragOver ? 'border-gold-500 bg-gold-500/5 scale-[1.01]' : 'border-white/10 hover:border-gold-500/40 hover:bg-white/3'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => handleUpload(e.target.files[0])} />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={40} className="text-gold-400 animate-spin" />
              <p className="text-white font-semibold">Analyzing resume...</p>
              <p className="text-gray-500 text-sm">Extracting skills & experience</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
                <Upload size={28} className="text-gold-400" />
              </div>
              <div>
                <p className="text-white font-bold">Drop your resume PDF here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse · PDF only · Max 5 MB</p>
              </div>
              <p className="text-xs text-gray-600 max-w-sm">
                Once uploaded, every interview automatically uses your resume to ask personalised questions about your actual skills.
              </p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-4 font-medium">{error}</p>}
        </div>
      )}
    </motion.div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
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
            You're on a roll! Let's crush another interview today.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard icon={BarChart2}  label="Total Interviews"   value={historyStats?.total     || 0} sub="Keep it up!"  color="gold"  index={0} />
          <StatCard icon={TrendingUp} label="Average Score"      value={historyStats?.avgScore  || 0} sub="Out of 100"  color="blue"  index={1} />
          <StatCard icon={Trophy}     label="Best Performance"   value={historyStats?.bestScore || 0} sub="Top Score"   color="green" index={2} />
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl p-8 sm:p-10 mb-10 border border-gold-500/20"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(180,83,9,0.04) 100%)' }}
        >
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
                {user?.resumeContext
                  ? '✨ Your resume is active — questions will be personalised to your background.'
                  : 'Choose from Technical, HR, or subject-based Viva sessions tailored to your domain.'}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/select')}
              className="btn-gold flex-shrink-0 px-8 py-4 rounded-2xl text-base font-bold flex items-center gap-2 shadow-gold-md"
            >
              Start Now <ArrowRight size={18} />
            </motion.button>
          </div>
        </motion.div>

        {/* ── Resume Card ── */}
        <ResumeCard user={user} />

        {/* Recent Interviews */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.45 }}
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
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.07 }}
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
