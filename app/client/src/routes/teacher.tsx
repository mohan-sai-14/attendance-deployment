import { lazy, Suspense, ReactNode } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Lazy load teacher pages
const TeacherLayout = lazy(() => import('../pages/teacher'));
const Dashboard = lazy(() => import('../pages/teacher/Dashboard'));
const QRGenerator = lazy(() => import('../pages/teacher/qr-generator'));
const ManualAttendance = lazy(() => import('../pages/teacher/manual-attendance'));
const AttendanceHistory = lazy(() => import('../pages/teacher/attendance-history'));
const Reports = lazy(() => import('../pages/teacher/reports'));

// Suspense wrapper for lazy loading
const SuspenseWrapper = ({ children }: { children: ReactNode }) => (
  <Suspense 
    fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }
  >
    {children}
  </Suspense>
);

// Teacher layout wrapper
export const TeacherLayoutWrapper = () => {
  return (
    <SuspenseWrapper>
      <TeacherLayout>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="qr-generator" element={<QRGenerator />} />
          <Route path="manual-attendance" element={<ManualAttendance />} />
          <Route path="attendance-history" element={<AttendanceHistory />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </TeacherLayout>
    </SuspenseWrapper>
  );
};

// Export the lazy-loaded components for use in App.tsx
export { 
  Dashboard, 
  QRGenerator, 
  ManualAttendance, 
  AttendanceHistory, 
  Reports 
};
