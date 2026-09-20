import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Participant Pages (Directly bundled for instant load)
import Login from '../pages/participant/Login';
import WaitingRoom from '../pages/participant/WaitingRoom';
import Strike1 from '../pages/participant/Strike1';
import Strike2 from '../pages/participant/Strike2';
import Strike3 from '../pages/participant/Strike3';
import StrikeComplete from '../pages/participant/StrikeComplete';
import RoundComplete from '../pages/participant/RoundComplete';

// Organizer Pages (Isolated chunk via dynamic import)
const OrganizerLogin = React.lazy(() => import('../pages/organizer/OrganizerLogin'));
const Overview = React.lazy(() => import('../pages/organizer/Overview'));
const RoundControl = React.lazy(() => import('../pages/organizer/RoundControl'));
const TeamManagement = React.lazy(() => import('../pages/organizer/TeamManagement'));
const JudgeManagement = React.lazy(() => import('../pages/organizer/JudgeManagement'));
const LiveMonitoring = React.lazy(() => import('../pages/organizer/LiveMonitoring'));
const Submissions = React.lazy(() => import('../pages/organizer/Submissions'));
const SessionManagement = React.lazy(() => import('../pages/organizer/SessionManagement'));
const SystemStatus = React.lazy(() => import('../pages/organizer/SystemStatus'));
const Results = React.lazy(() => import('../pages/organizer/Results'));

// Judge Pages (Isolated chunk via dynamic import)
const JudgeLogin = React.lazy(() => import('../pages/judge/JudgeLogin'));
const AssignedTeams = React.lazy(() => import('../pages/judge/AssignedTeams'));
const TeamSubmissions = React.lazy(() => import('../pages/judge/TeamSubmissions'));
const Evaluation = React.lazy(() => import('../pages/judge/Evaluation'));

// Protected Route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'participant' | 'organizer' | 'judge';
}

function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== allowedRole) {
    if (allowedRole === 'organizer') return <Navigate to="/organizer/login" replace />;
    if (allowedRole === 'judge') return <Navigate to="/judge/login" replace />;
    return <Navigate to="/participant/login" replace />;
  }

  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-dark-950 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>
          {/* Default Route */}
          <Route path="/" element={<Navigate to="/participant/login" replace />} />

        {/* Participant Routes */}
        <Route path="/participant/login" element={<Login />} />
        <Route
          path="/participant/waiting"
          element={
            <ProtectedRoute allowedRole="participant">
              <WaitingRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/strike1"
          element={
            <ProtectedRoute allowedRole="participant">
              <Strike1 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/strike2"
          element={
            <ProtectedRoute allowedRole="participant">
              <Strike2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/strike3"
          element={
            <ProtectedRoute allowedRole="participant">
              <Strike3 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/strike-complete"
          element={
            <ProtectedRoute allowedRole="participant">
              <StrikeComplete />
            </ProtectedRoute>
          }
        />
        <Route
          path="/participant/round-complete"
          element={
            <ProtectedRoute allowedRole="participant">
              <RoundComplete />
            </ProtectedRoute>
          }
        />

        {/* Organizer Routes */}
        <Route path="/organizer" element={<Navigate to="/organizer/overview" replace />} />
        <Route path="/organizer/login" element={<OrganizerLogin />} />
        <Route
          path="/organizer/overview"
          element={
            <ProtectedRoute allowedRole="organizer">
              <Overview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/round-control"
          element={
            <ProtectedRoute allowedRole="organizer">
              <RoundControl />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/teams"
          element={
            <ProtectedRoute allowedRole="organizer">
              <TeamManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/judges"
          element={
            <ProtectedRoute allowedRole="organizer">
              <JudgeManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/submissions"
          element={
            <ProtectedRoute allowedRole="organizer">
              <Submissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/monitor"
          element={
            <ProtectedRoute allowedRole="organizer">
              <LiveMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/sessions"
          element={
            <ProtectedRoute allowedRole="organizer">
              <SessionManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/system-status"
          element={
            <ProtectedRoute allowedRole="organizer">
              <SystemStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizer/results"
          element={
            <ProtectedRoute allowedRole="organizer">
              <Results />
            </ProtectedRoute>
          }
        />

        {/* Judge Routes */}
        <Route path="/judge" element={<Navigate to="/judge/teams" replace />} />
        <Route path="/judge/login" element={<JudgeLogin />} />
        <Route
          path="/judge/teams"
          element={
            <ProtectedRoute allowedRole="judge">
              <AssignedTeams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/judge/team/:teamId"
          element={
            <ProtectedRoute allowedRole="judge">
              <TeamSubmissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/judge/evaluate/:teamId"
          element={
            <ProtectedRoute allowedRole="judge">
              <Evaluation />
            </ProtectedRoute>
          }
        />
        <Route path="/judge/evaluation" element={<Navigate to="/judge/teams" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/participant/login" replace />} />
      </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}
