import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/student/Sidebar';
import { Header } from '@/components/student/header';
import BottomNav from '@/components/student/BottomNav';

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} userRole="student" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6 pb-24">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
