import { createContext, useContext, useState, useEffect } from 'react';
import { authClient } from '../api/client';
import client from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params       = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await authClient.get('/verify', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.valid) setUser(res.data.user);
      else localStorage.removeItem('token');
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  // ── Email register ─────────────────────────────────────────────────────────
  const emailRegister = async (name, email, password) => {
    try {
      const res = await authClient.post('/register', { name, email, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Registration failed.' };
    }
  };

  // ── Email login ────────────────────────────────────────────────────────────
  const emailLogin = async (email, password) => {
    try {
      const res = await authClient.post('/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: res.data.error };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed.' };
    }
  };

  // ── Update profile (name / avatar) ─────────────────────────────────────────
  const updateProfile = async (fields) => {
    try {
      const res = await client.put('/user/profile', fields);
      if (res.data.success) {
        // Explicitly merge only the fields we updated to avoid shape mismatches
        setUser(prev => ({
          ...prev,
          ...(fields.name   ? { name: fields.name.trim() }   : {}),
          ...(fields.avatar ? { avatar: fields.avatar }       : {}),
        }));
        return { success: true };
      }
      return { success: false, error: res.data.error || 'Update failed.' };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Update failed.' };
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, emailLogin, emailRegister, logout, updateProfile, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
