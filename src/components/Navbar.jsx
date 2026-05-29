import { useNavigate } from 'react-router-dom';
import { LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const userName = user?.name || 'Guest User';
  const avatarInitials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 group">
          <img
            src="/logo.png"
            alt="AI InterviewPrep Logo"
            className="w-9 h-9 object-contain drop-shadow-[0_0_6px_rgba(249,115,22,0.6)] group-hover:drop-shadow-[0_0_10px_rgba(249,115,22,0.9)] transition-all duration-300"
          />
          <span className="text-lg font-bold tracking-tight">
            <span className="gold-text">AI</span> InterviewPrep
          </span>
        </button>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Avatar — clickable → profile */}
          <button
            onClick={() => navigate('/profile')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-white/5 hover:border-gold-500/30 transition-all group"
          >
            <div className="w-7 h-7 rounded-full btn-gold flex items-center justify-center text-xs font-bold text-black">
              {user?.avatar
                ? <img src={user.avatar} alt={userName} className="w-full h-full rounded-full object-cover" />
                : avatarInitials}
            </div>
            <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{userName}</span>
            <UserCircle size={13} className="text-gray-500 group-hover:text-gold-400 transition-colors" />
          </button>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/40 hover:bg-red-500/5 text-gray-400 hover:text-red-400 text-sm font-medium transition-all duration-200"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
