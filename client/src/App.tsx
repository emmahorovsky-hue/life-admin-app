import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
// Landing is the marketing entry point ('/') — eager-import it so it paints on
// the first round trip instead of waterfalling through the Suspense fallback.
import Landing from './pages/Landing';
import { LoadingScreen } from './components/LoadingScreen';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Timeline = lazy(() => import('./pages/Timeline'));
const VerifyEmailSuccess = lazy(() => import('./pages/VerifyEmailSuccess'));
const VerifyEmailError = lazy(() => import('./pages/VerifyEmailError'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
// /profile was replaced by /settings (LIF-181). Keep redirecting forever —
// bookmarks and email-change confirmations target it — and preserve the query
// string, which carries the confirmation outcome AccountPanel reads.
export function ProfileRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/settings/account', search: location.search }} replace />;
}

const SettingsShell = lazy(() => import('./pages/settings/SettingsShell'));
const SettingsIndexOrRedirect = lazy(() => import('./pages/settings/SettingsIndexOrRedirect'));
const AccountPanel = lazy(() => import('./pages/settings/AccountPanel'));
const NotificationsPanel = lazy(() => import('./pages/settings/NotificationsPanel'));
const AppearancePanel = lazy(() => import('./pages/settings/AppearancePanel'));
const PrivacyPanel = lazy(() => import('./pages/settings/PrivacyPanel'));
const DesignSystem = lazy(() => import('./pages/DesignSystem'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

function App() {
  return (
    <AuthProvider>
      {/* ThemeProvider sits under AuthProvider so it can adopt the server
          theme preference, and above Router so every route is themed. */}
      <ThemeProvider>
      <Router>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email/success" element={<VerifyEmailSuccess />} />
            <Route path="/verify-email/error" element={<VerifyEmailError />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscriptions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Subscriptions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Timeline />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SettingsShell />
                  </Layout>
                </ProtectedRoute>
              }
            >
              <Route index element={<SettingsIndexOrRedirect />} />
              <Route path="account" element={<AccountPanel />} />
              <Route path="notifications" element={<NotificationsPanel />} />
              <Route path="appearance" element={<AppearancePanel />} />
              <Route path="privacy" element={<PrivacyPanel />} />
            </Route>
            {/* Permanent redirect: bookmarks and email-change confirmation
                links (web + already-sent emails) still target /profile. */}
            <Route path="/profile" element={<ProfileRedirect />} />
            {import.meta.env.DEV && (
              <Route path="/design-system" element={<DesignSystem />} />
            )}
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/" element={<Landing />} />
          </Routes>
        </Suspense>
      </Router>
      <Toaster />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
