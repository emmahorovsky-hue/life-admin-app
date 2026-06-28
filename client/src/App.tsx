import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
const Profile = lazy(() => import('./pages/Profile'));
const DesignSystem = lazy(() => import('./pages/DesignSystem'));

function App() {
  return (
    <AuthProvider>
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
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/design-system" element={<DesignSystem />} />
            <Route path="/" element={<Landing />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
