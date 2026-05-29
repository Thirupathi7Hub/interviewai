import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Calendar, Trophy, BarChart2, TrendingUp,
  Edit3, Check, X, Shield, LogOut, Star, Camera, Loader2
} from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

function grade(score) {
  if (score >= 90) return { label: 'Outstanding', color: '#4ade80' };
  if (score >= 75) return { label: 'Excellent',   color: '#4ade80' };
  if (score >= 60) return { label: 'Good',         color: '#f59e0b' };
  if (score >= 40) return { label: 'Satisfactory', color: '#f59e0b' };
  return                   { label: 'Needs Work',  color: '#f87171' };
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const { history, historyStats, fetchHistory } = useInterview();

  const [editing,      setEditing]      = useState(false);
  const [nameVal,      setNameVal]      = useState(user?.name || '');
  const [savingName,   setSavingName]   = useState(false);
  const [nameError,    setNameError]    = useState('');
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picError,     setPicError]     = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  const avatarInitials = (user?.name || 'U')
    .split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const recent = history.slice(0, 5);

  // ── Save name ──────────────────────────────────────────────────────────────
  const saveName = async () => {
    const trimmed = nameVal.trim();
    if (!trimmed || trimmed.length < 2) {
      setNameError('Name must be at least 2 characters.');
      return;
    }
    if (trimmed === user?.name) { setEditing(false); return; }
    setSavingName(true);
    setNameError('');
    const res = await updateProfile({ name: trimmed });
    setSavingName(false);
    if (res.success) setEditing(false);
    else setNameError(res.error || 'Failed to save.');
  };

  // ── Avatar upload (convert to base64, save to Supabase) ───────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPicError('Please choose an image file.'); return; }
    if (file.size > 2 * 1024 * 1024)    { setPicError('Image must be under 2 MB.');    return; }

    setPicError('');
    setUploadingPic(true);

    // Compress + convert to base64 via canvas
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.75);

        const res = await updateProfile({ avatar: base64 });
        setUploadingPic(false);
        if (!res.success) setPicError(res.error || 'Upload failed.');
      };
      img.onerror = () => { setUploadingPic(false); setPicError('Could not read image.'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="min-h-screen bg-[#0a0a0a]">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Hero card ── */}
        <motion.div custom={0} variants={FADE_UP} initial="hidden" animate="visible"
          className="relative overflow-hidden rounded-3xl border border-white/8 p-8 mb-6"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(17,17,17,1) 60%)' }}>
          <div className="absolute -top-20 -left-20 w-60 h-60 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ background: '#f59e0b' }} />

          <div className="relative flex flex-col sm:flex-row gap-6 items-start sm:items-center">

            {/* ── Avatar with upload overlay ── */}
            <div className="relative flex-shrink-0 group">
              <div className="w-24 h-24 rounded-3xl overflow-hidden btn-gold flex items-center justify-center text-3xl font-black text-black shadow-gold-md">
                {user?.avatar
                  ? <img src={user.avatar} alt={user?.name} className="w-full h-full object-cover" />
                  : <span>{avatarInitials}</span>}
              </div>

              {/* Camera overlay on hover */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPic}
                className="absolute inset-0 rounded-3xl flex flex-col items-center justify-center gap-1
                  bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingPic
                  ? <Loader2 size={20} className="text-white animate-spin" />
                  : <>
                      <Camera size={18} className="text-white" />
                      <span className="text-white text-[10px] font-semibold">Change</span>
                    </>
                }
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />

              {/* Online dot */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-400 border-2 border-[#0a0a0a]" />
            </div>

            {/* ── Name / email ── */}
            <div className="flex-1 min-w-0">
              {/* Name editor */}
              {editing ? (
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameVal}
                      onChange={e => { setNameVal(e.target.value); setNameError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditing(false); setNameVal(user?.name || ''); } }}
                      className="bg-white/5 border border-gold-500/40 text-white text-2xl font-black rounded-xl px-3 py-1 outline-none focus:border-gold-400 w-full max-w-xs"
                    />
                    <button onClick={saveName} disabled={savingName}
                      className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50">
                      {savingName ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button onClick={() => { setEditing(false); setNameVal(user?.name || ''); setNameError(''); }}
                      className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-white">{user?.name}</h1>
                  <button onClick={() => { setEditing(true); setNameVal(user?.name || ''); }}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-gray-300 transition-colors">
                    <Edit3 size={14} />
                  </button>
                </div>
              )}

              {picError && <p className="text-red-400 text-xs mb-2">{picError}</p>}

              <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
                <Mail size={13} className="opacity-60" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar size={12} />
                  <span>Joined {joinDate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Shield size={12} />
                  <span>{user?.googleId ? 'Google Account' : 'Email Account'}</span>
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-sm font-semibold transition-all flex-shrink-0">
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </motion.div>

        {/* ── 3 big stat cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            { label: 'Interviews Done', value: historyStats?.total     || 0, color: '#f59e0b', emoji: '📊', sub: 'Total sessions completed' },
            { label: 'Average Score',   value: historyStats?.avgScore  || 0, color: '#60a5fa', emoji: '📈', sub: 'Mean score across all sessions' },
            { label: 'Best Score',      value: historyStats?.bestScore || 0, color: '#4ade80', emoji: '🏆', sub: 'Your highest single session score' },
          ].map((s, i) => (
            <motion.div key={s.label} custom={i + 1} variants={FADE_UP} initial="hidden" animate="visible">
              <div className="relative overflow-hidden rounded-3xl border p-8 flex flex-col gap-4 bg-white/3"
                style={{ borderColor: `${s.color}22` }}>
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-10 pointer-events-none"
                  style={{ background: s.color }} />
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                  {s.emoji}
                </div>
                <div className="text-5xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div>
                  <p className="text-lg font-black text-white">{s.label}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.sub}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Two-col layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent interviews */}
          <motion.div custom={5} variants={FADE_UP} initial="hidden" animate="visible" className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Recent Interviews</h2>
              <button onClick={() => navigate('/dashboard')}
                className="text-xs text-gold-400 hover:text-gold-300 font-medium transition-colors">View all →</button>
            </div>
            <div className="glass rounded-2xl border border-white/8 overflow-hidden">
              {recent.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                    <BarChart2 size={20} className="text-gray-600" />
                  </div>
                  <p className="text-gray-500 text-sm">No interviews yet.</p>
                  <button onClick={() => navigate('/select')}
                    className="mt-3 text-xs text-gold-400 hover:text-gold-300 font-medium transition-colors">
                    Start your first interview →
                  </button>
                </div>
              ) : recent.map((item, i) => {
                const { label: gl, color: gc } = grade(item.finalScore || 0);
                return (
                  <motion.div key={item._id || i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.06 }}
                    className="flex items-center gap-4 px-5 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${gc}18`, border: `1px solid ${gc}30` }}>
                      <span className="text-xs font-black" style={{ color: gc }}>{item.finalScore || 0}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.domain} — {item.type}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.completedAt ? new Date(item.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ color: gc, background: `${gc}15`, border: `1px solid ${gc}30` }}>{gl}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Achievements */}
          <motion.div custom={6} variants={FADE_UP} initial="hidden" animate="visible">
            <h2 className="text-base font-bold text-white mb-4">Achievements</h2>
            <div className="glass rounded-2xl border border-white/8 p-5 space-y-3">
              {[
                { icon: '🚀', label: 'First Interview',  earned: historyStats?.total >= 1,          desc: 'Complete your first session' },
                { icon: '🔥', label: '5 Interviews',     earned: historyStats?.total >= 5,          desc: 'Complete 5 sessions' },
                { icon: '⚡', label: 'Speed Runner',     earned: historyStats?.total >= 10,         desc: 'Complete 10 sessions' },
                { icon: '🏆', label: 'High Scorer',      earned: historyStats?.bestScore >= 80,     desc: 'Score 80+ in a session' },
                { icon: '🎯', label: 'Perfectionist',    earned: historyStats?.bestScore >= 95,     desc: 'Score 95+ in a session' },
                { icon: '💎', label: 'Consistent',       earned: historyStats?.avgScore >= 70,      desc: 'Avg score above 70' },
              ].map((a) => (
                <div key={a.label} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  a.earned ? 'bg-gold-500/8 border border-gold-500/20' : 'opacity-35'
                }`}>
                  <span className="text-xl flex-shrink-0">{a.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${a.earned ? 'text-white' : 'text-gray-500'}`}>{a.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{a.desc}</p>
                  </div>
                  {a.earned && <Star size={12} className="text-gold-400 fill-gold-400 flex-shrink-0 ml-auto" />}
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </main>
    </motion.div>
  );
}
