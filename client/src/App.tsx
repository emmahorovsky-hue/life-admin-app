import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
// Landing is the marketing entry point ('/') — eager-import it so it paints on
// the first round trip instead of waterfalling through the Suspense fallback.
import Landing from './pages/Landing';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const VerifyEmailSuccess = lazy(() => import('./pages/VerifyEmailSuccess'));
const VerifyEmailError = lazy(() => import('./pages/VerifyEmailError'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Profile = lazy(() => import('./pages/Profile'));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageFallback />}>
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
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Landing />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
