import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import BlogPage from './pages/BlogPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';
import LandingPage from './pages/LandingPage';

// Lazy so three.js only loads on /story, keeping the other pages light.
const StoryLandingPage = lazy(() => import('./pages/StoryLandingPage'));
import WorkspacePage from './pages/WorkspacePage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import GoogleCallbackPage from './pages/GoogleCallbackPage';
import { useTheme } from './hooks/useTheme';

function App() {
  // Initialize theme system — auto-detects system preference
  useTheme();

  return (
    <Router>
      <Routes>
        {/* Landing = the story page (root, indexable). Old marketing home lives at /home. */}
        <Route path="/" element={<Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}><StoryLandingPage /></Suspense>} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        {/* Old story URL now redirects to the root landing (avoids duplicate content). */}
        <Route path="/story" element={<Navigate to="/" replace />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/app" element={<WorkspacePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/google-callback" element={<GoogleCallbackPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
