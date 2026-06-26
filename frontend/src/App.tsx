import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Topbar } from './components/Topbar';
import { ProtectedRoute, RoleRoute } from './components/RouteGuards';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ApplicantListPage } from './pages/ApplicantListPage';
import { ReviewerQueuePage } from './pages/ReviewerQueuePage';
import { ApplicationFormPage } from './pages/ApplicationFormPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';

export function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading-block">Loading…</div>;
  }

  return (
    <div className="app-shell">
      <Topbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-applications"
          element={
            <ProtectedRoute>
              <RoleRoute role="APPLICANT">
                <ApplicantListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/queue"
          element={
            <ProtectedRoute>
              <RoleRoute role="REVIEWER">
                <ReviewerQueuePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/applications/new"
          element={
            <ProtectedRoute>
              <RoleRoute role="APPLICANT">
                <ApplicationFormPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/applications/:id/edit"
          element={
            <ProtectedRoute>
              <RoleRoute role="APPLICANT">
                <ApplicationFormPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Detail page is shared by both roles — the page itself adapts
            which actions it shows based on req.user inside the API
            response and the logged-in user's role. */}
        <Route
          path="/applications/:id"
          element={
            <ProtectedRoute>
              <ApplicationDetailPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<div className="main">Page not found.</div>} />
      </Routes>
    </div>
  );
}
