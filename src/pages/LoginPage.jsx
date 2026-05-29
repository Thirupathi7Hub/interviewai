import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Loader, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { emailLogin, emailRegister } = useAuth();
  const [tab, setTab]           = useState('login');   // 'login' | 'register'
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.email || !form.password) return setError('Please fill in all fields.');
    if (tab === 'register' && !form.name)  return setError('Please enter your name.');

    setLoading(true);
    try {
      const result = tab === 'login'
        ? await emailLogin(form.email, form.password)
        : await emailRegister(form.name, form.email, form.password);

      if (!result.success) setError(result.error || 'Something went wrong.');
      else if (tab === 'register') {
        setSuccess('Account created! You are now logged in.');
      }
    } catch {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-bg noise flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #d97706, transparent)' }} />
      <div className="absolute top-10 right-1/3 w-2 h-2 rounded-full bg-gold-400 opacity-60 animate-pulse-slow" />
      <div className="absolute bottom-20 left-1/4 w-1.5 h-1.5 rounded-full bg-gold-300 opacity-40 animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/3 right-1/4 w-1 h-1 rounded-full bg-gold-500 opacity-50 animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 sm:p-10 border border-white/10 shadow-card">

          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <img
                src="/logo.png"
                alt="AI InterviewPrep"
                className="w-16 h-16 object-contain drop-shadow-[0_0_14px_rgba(249,115,22,0.7)]"
              />
            </motion.div>
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-tight">
                <span className="gold-text">AI</span> InterviewPrep
              </h1>
              <p className="text-gray-500 text-xs mt-1 font-medium tracking-wide">Practice. Improve. Succeed.</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1 mb-6 gap-1">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-gold-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {tab === 'register' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Full Name</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="John Doe"
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-500/60 transition-colors"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-500/60 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder={tab === 'register' ? 'Min 6 characters' : '••••••••'}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gold-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error / Success */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
                >
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs">{error}</p>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5"
                >
                  <p className="text-green-400 text-xs">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : tab === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-xs text-gray-600">or</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>

          {/* Google OAuth */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || ''}/auth/google`}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 transition-all shadow-lg shadow-black/20"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L37.518 9.48C34.148 6.371 29.307 4.5 24 4.5 12.978 4.5 4 13.478 4 24.5s8.978 20 20 20c10.985 0 19.956-8.945 19.956-20 0-1.341-.138-2.65-.345-3.917z" fill="#FFC107"/>
              <path d="M6.306 15.691l6.571 4.819C14.655 17.108 19.001 14 24 14c3.059 0 5.842 1.154 7.961 3.039L37.518 9.48C34.148 6.371 29.307 4.5 24 4.5c-7.734 0-14.47 4.126-18.194 10.191z" fill="#FF3D00"/>
              <path d="M24 44.5c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.816-3.337-11.308-7.946l-6.522 5.025C9.505 40.526 16.227 44.5 24 44.5z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24.5c0-1.341-.138-2.65-.389-4.417z" fill="#1976D2"/>
            </svg>
            Continue with Google
          </motion.button>

          <p className="text-center text-xs text-gray-600 mt-5 leading-relaxed">
            By continuing you agree to our{' '}
            <span className="text-gold-500 cursor-pointer hover:underline">Terms</span> and{' '}
            <span className="text-gold-500 cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-5 grid grid-cols-3 gap-3 text-center"
        >
          {[{ val: '10K+', label: 'Students' }, { val: '50K+', label: 'Interviews' }, { val: '4.9★', label: 'Rating' }].map(s => (
            <div key={s.label} className="glass rounded-xl py-3 border border-white/5">
              <p className="text-sm font-bold gold-text">{s.val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
