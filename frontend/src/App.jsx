import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';

// Layouts
import DashboardLayout from './components/layout/DashboardLayout';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Dashboard pages
import AdminDashboard from './pages/dashboard/AdminDashboard';
import ClientDashboard from './pages/dashboard/ClientDashboard';

// Feature pages
import Leads from './pages/leads/Leads';
import Clients from './pages/clients/Clients';
import Projects from './pages/projects/Projects';
import ProjectDetail from './pages/projects/ProjectDetail';
import CalendarPage from './pages/calendar/CalendarPage';
import Invoices from './pages/invoices/Invoices';
import Questionnaires from './pages/questionnaires/Questionnaires';
import Insights from './pages/insights/Insights';

// Placeholder pages (still needed for settings)
import { SettingsPage } from './pages/placeholders';

// Public pages
import InquiryForm from './pages/public/InquiryForm';
import PublicQuestionnaire from './pages/public/PublicQuestionnaire';

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, user } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Dashboard Router - shows different dashboard based on role
function DashboardRouter() {
  const { isAdmin } = useAuthStore();
  return isAdmin() ? <AdminDashboard /> : <ClientDashboard />;
}

function App() {
  const { refreshUser, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      refreshUser();
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/inquiry" element={<InquiryForm />} />
        <Route path="/questionnaire/:token" element={<PublicQuestionnaire />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardRouter />} />
          
          {/* Admin only routes */}
          <Route
            path="leads"
            element={
              <ProtectedRoute adminOnly>
                <Leads />
              </ProtectedRoute>
            }
          />
          <Route
            path="clients"
            element={
              <ProtectedRoute adminOnly>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="clients/:id"
            element={
              <ProtectedRoute adminOnly>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="insights"
            element={
              <ProtectedRoute adminOnly>
                <Insights />
              </ProtectedRoute>
            }
          />

          {/* Shared routes (admin and client) */}
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="questionnaires" element={<Questionnaires />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<Invoices />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      
      <Toaster 
        position="top-right"
        containerStyle={{
          top: 20,
          right: 20,
        }}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            padding: '12px 16px',
            borderRadius: '8px',
          },
          success: {
            duration: 2000,
            iconTheme: {
              primary: '#587792',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
