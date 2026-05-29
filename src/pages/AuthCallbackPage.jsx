import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');

    if (token) {
      localStorage.setItem('token', token);
      // Clean token from URL
      window.history.replaceState({}, document.title, '/auth/callback');
    }

    // Reload user from backend then go to dashboard
    (checkAuth ? checkAuth() : Promise.resolve()).then(() => {
      navigate('/dashboard', { replace: true });
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
