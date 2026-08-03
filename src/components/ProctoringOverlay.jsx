import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, ShieldX, AlertTriangle, Brain, Eye, EyeOff, Zap } from 'lucide-react';

const MAX_VIOLATIONS = 3;

const EMOTION_COLORS = {
  confident:   'text-green-400',
  calm:        'text-green-400',
  focused:     'text-blue-400',
  uncertain:   'text-yellow-400',
  nervous:     'text-yellow-400',
  stressed:    'text-orange-400',
  distracted:  'text-red-400',
};

export default function ProctoringOverlay({
  confidenceScore,
  alert,
  violationCount,
  onEndSession,
  // AI confidence props (optional)
  aiScore      = null,
  emotion      = '',
  engagement   = '',
  eyeContact   = true,
  insight      = '',
  isAnalyzing  = false,
  isModelsLoading = false,
}) {
  // Prefer AI score when available, fall back to heuristic score
  const displayScore = aiScore !== null ? aiScore : confidenceScore;
  const level = displayScore >= 75 ? 'good' : displayScore >= 45 ? 'warn' : 'danger';
  const hasAI = aiScore !== null;

  const theme = {
    good:   { ring: '#4ade80', text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/25' },
    warn:   { ring: '#facc15', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25' },
    danger: { ring: '#f87171', text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/25' },
  }[level];

  const Icon = level === 'good' ? Shield : level === 'warn' ? ShieldAlert : ShieldX;
  const emotionColor = emotion ? (EMOTION_COLORS[emotion] || 'text-gray-400') : 'text-gray-400';

  const R          = 20;
  const circum     = 2 * Math.PI * R;
  const dashOffset = circum * (1 - Math.max(0, displayScore) / 100);

  return (
    <>
      {/* ── AI Confidence HUD ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={`absolute top-[72px] left-3 z-30 ${theme.bg} ${theme.border} border backdrop-blur-md rounded-2xl px-3 py-2.5 flex flex-col gap-2 shadow-xl min-w-[130px]`}
      >
        {/* Score row */}
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex-shrink-0">
            <svg viewBox="0 0 50 50" className="w-full h-full -rotate-90">
              <circle cx="25" cy="25" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
              <circle
                cx="25" cy="25" r={R} fill="none"
                strokeWidth="5" strokeLinecap="round"
                style={{
                  stroke: theme.ring,
                  strokeDasharray: circum,
                  strokeDashoffset: dashOffset,
                  transition: 'stroke-dashoffset 0.7s ease, stroke 0.4s ease',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon size={13} className={theme.text} />
            </div>
          </div>

          <div className="min-w-[60px]">
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider leading-none">Confidence</p>
              {hasAI && (
                <span className="flex items-center gap-0.5 bg-purple-500/20 border border-purple-500/30 rounded px-1 py-0.5">
                  <Brain size={7} className="text-purple-400" />
                  <span className="text-[7px] text-purple-400 font-bold">AI</span>
                  {isAnalyzing && <Zap size={6} className="text-purple-300 animate-pulse ml-0.5" />}
                </span>
              )}
            </div>
            <p className={`text-2xl font-black leading-none ${theme.text}`}>{Math.round(displayScore)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i < violationCount ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'bg-white/10'}`}
                />
              ))}
              <span className="text-[9px] text-gray-600 ml-0.5">violations</span>
            </div>
          </div>
        </div>

        {/* Loading models state */}
        {isModelsLoading && (
          <div className="border-t border-white/5 pt-2 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500" />
            </span>
            <p className="text-[8px] text-yellow-500 font-bold uppercase tracking-widest animate-pulse">Initializing AI</p>
          </div>
        )}

        {/* Emotion + engagement row (AI only) */}
        {hasAI && emotion && (
          <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold capitalize ${emotionColor}`}>{emotion}</span>
              <div className="flex items-center gap-1">
                {eyeContact
                  ? <Eye size={10} className="text-green-400" />
                  : <EyeOff size={10} className="text-yellow-400" />}
                <span className="text-[9px] text-gray-500">{eyeContact ? 'on camera' : 'look at cam'}</span>
              </div>
            </div>
            {engagement && (
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${engagement === 'high' ? 'bg-green-400' : engagement === 'medium' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                <span className="text-[9px] text-gray-500 capitalize">{engagement} engagement</span>
              </div>
            )}
          </div>
        )}

        {/* AI insight quote */}
        {hasAI && insight && (
          <p className="text-[8px] text-gray-400 leading-tight border-t border-white/5 pt-1.5 italic">
            "{insight}"
          </p>
        )}
      </motion.div>

      {/* ── Alert toast ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {alert && (
          <motion.div
            key={alert.message}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className={`absolute bottom-44 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm rounded-2xl px-4 py-3.5 backdrop-blur-xl shadow-2xl border flex items-start gap-3 ${
              alert.type === 'danger'
                ? 'bg-red-500/20 border-red-500/40'
                : 'bg-yellow-500/15 border-yellow-500/30'
            }`}
          >
            <AlertTriangle
              size={18}
              className={`flex-shrink-0 mt-0.5 ${alert.type === 'danger' ? 'text-red-400' : 'text-yellow-400'}`}
            />
            <p className="text-white text-sm leading-snug font-medium">{alert.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Session termination overlay ──────────────────────────────────── */}
      <AnimatePresence>
        {violationCount >= MAX_VIOLATIONS && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-[#0f0f0f] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
                  <ShieldX size={26} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Interview Flagged</h2>
                  <p className="text-xs text-red-400 font-semibold">Integrity violations exceeded</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                You exceeded the maximum of <span className="text-red-400 font-bold">3 integrity violations</span>.
                Your session has been automatically flagged and terminated.
              </p>
              <button
                onClick={onEndSession}
                className="w-full bg-red-500 hover:bg-red-400 text-white font-bold py-3 rounded-xl transition-colors text-sm"
              >
                View Partial Results
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
