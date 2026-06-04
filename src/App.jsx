import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { InterviewProvider } from './context/InterviewContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SubjectSelectionPage from './pages/SubjectSelectionPage.jsx';
import InterviewSessionPage from './pages/InterviewSessionPage.jsx';
import FeedbackPage from './pages/FeedbackPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AuthCallbackPage from './pages/AuthCallbackPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-4 border-gold-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/select" element={<ProtectedRoute><SubjectSelectionPage /></ProtectedRoute>} />
        <Route path="/session" element={<ProtectedRoute><InterviewSessionPage /></ProtectedRoute>} />
        <Route path="/feedback"     element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
        <Route path="/feedback/:id" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/oauth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InterviewProvider>
        <AppRoutes />
      </InterviewProvider>
    </AuthProvider>
  );
}
