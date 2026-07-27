import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
        {/* Marketing home. Logged-in users are redirected to /app inside HomePage. */}
        <Route path="/" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/story" element={<Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}><StoryLandingPage /></Suspense>} />
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
