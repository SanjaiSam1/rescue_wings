/**
 * Main App - Routing and providers
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UserDashboard from './pages/UserDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import VolunteerMissionHistoryPage from './pages/VolunteerMissionHistoryPage';
import AdminDashboard from './pages/AdminDashboard';
import EmergencyRequestPage from './pages/EmergencyRequestPage';
import TrackingPage from './pages/TrackingPage';
import RequestHistoryPage from './pages/RequestHistoryPage';
import MapPage from './pages/MapPage';
import AlertsPage from './pages/AlertsPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import OnboardingPage from './pages/OnboardingPage';
import { getHomeRouteByRole } from './utils/roleRoutes';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"/></div>;
  if (!user) return <Navigate to="/login" replace />;
  const onboardingKey = user._id || user.email || user.role;
  const isOnboarded = localStorage.getItem(`rw_onboarded_${onboardingKey}`) === 'true';
  if (!isOnboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={getHomeRouteByRole(user.role)} replace />;
  return children;
};

const DashboardRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={getHomeRouteByRole(user.role)} />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/pending-approval" element={<PendingApprovalPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/home" element={<DashboardRedirect />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={['citizen']}><UserDashboard /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute roles={['citizen']}><RequestHistoryPage /></ProtectedRoute>} />
            <Route path="/volunteer" element={<ProtectedRoute roles={['volunteer']}><VolunteerDashboard /></ProtectedRoute>} />
            <Route path="/volunteer/history" element={<ProtectedRoute roles={['volunteer']}><VolunteerMissionHistoryPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute><EmergencyRequestPage /></ProtectedRoute>} />
            <Route path="/track/:id" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/chat/:userId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
