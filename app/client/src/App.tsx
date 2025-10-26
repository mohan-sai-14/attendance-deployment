import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/ui/theme-toggle';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense, ReactNode } from 'react';

// Teacher pages - Import the teacher components
import { TeacherLayoutWrapper } from './routes/teacher';

// Lazy load teacher pages
const Dashboard = lazy(() => import('@/pages/teacher/Dashboard'));
const QRGenerator = lazy(() => import('@/pages/teacher/qr-generator'));
const ManualAttendance = lazy(() => import('@/pages/teacher/manual-attendance'));
const AttendanceHistory = lazy(() => import('@/pages/teacher/attendance-history'));
const Reports = lazy(() => import('@/pages/teacher/reports'));

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Admin pages
const AdminLayout = lazy(() => import('./pages/admin/Layout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageUsers = lazy(() => import('./pages/admin/UserManagement'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));
const Students = lazy(() => import('./pages/admin/students'));
const AdminAttendance = lazy(() => import('./pages/admin/attendance'));


// Faculty pages
const FacultyLayout = lazy(() => import('./pages/faculty/Layout'));
const FacultyDashboard = lazy(() => import('./pages/faculty/Dashboard'));

// Student pages
const StudentLayout = lazy(() => import('./pages/student/Layout'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const MarkAttendance = lazy(() => import('./pages/student/MarkAttendance'));
const StudentAttendanceHistory = lazy(() => import('./pages/student/AttendanceHistory'));
const StudentScanner = lazy(() => import('./pages/student/scanner'));

// Create a client
const queryClient = new QueryClient();

// Protected Route component
interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
}

const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// App Router
const AppRouter = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="students" element={<Students />} />
          <Route path="attendance" element={<AdminAttendance />} />
        </Route>

        {/* Teacher Routes */}
        <Route
          path="/teacher/*"
          element={
            <ProtectedRoute roles={['teacher']}>
              <TeacherLayoutWrapper />
            </ProtectedRoute>
          }
        />

        {/* Faculty Routes */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute roles={['faculty']}>
              <FacultyLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FacultyDashboard />} />
          <Route path="dashboard" element={<FacultyDashboard />} />
        </Route>

        {/* Student Routes */}
        <Route
          path="/student"
          element={
            <ProtectedRoute roles={['student']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="scanner" element={<StudentScanner />} />
          <Route path="mark-attendance" element={<MarkAttendance />} />
          <Route path="attendance-history" element={<StudentAttendanceHistory />} />
        </Route>

        {/* 404 - Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

// Main App Component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <AppRouter />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
