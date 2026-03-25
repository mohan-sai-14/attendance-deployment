import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/student/Sidebar';
import { Header } from '@/components/student/header';
import BottomNav from '@/components/student/BottomNav';

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} userRole="student" />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto outline-none">
          <div className="px-4 py-6 sm:px-6 sm:py-8 pb-28 md:pb-8">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

