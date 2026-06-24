import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import WorkspacePage from './pages/WorkspacePage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import { useTheme } from './hooks/useTheme';

// Root route — send already-logged-in users to the app, others to login.
// (The token lives in localStorage, so it survives tab close / new tab / restart.)
function RootRedirect() {
  const loggedIn =
    typeof window !== 'undefined' &&
    !!localStorage.getItem('access_token') &&
    !!localStorage.getItem('user_id');
  return <Navigate to={loggedIn ? '/app' : '/login'} replace />;
}

function App() {
  // Initialize theme system — auto-detects system preference
  useTheme();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/app" element={<WorkspacePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
      </Routes>
    </Router>
  );
}

export default App;
