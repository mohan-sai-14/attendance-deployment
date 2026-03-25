import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, QrCode, ClipboardList, CalendarDays } from 'lucide-react';

const BottomNav: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/student/dashboard' && location.pathname === '/student') return true;
    return location.pathname === path;
  };

  const navItems = [
    { label: 'Home', path: '/student/dashboard', icon: Home },
    { label: 'Scan QR', path: '/student/scanner', icon: QrCode },
    { label: 'History', path: '/student/attendance-history', icon: ClipboardList },
    { label: 'Schedule', path: '/student/timetable', icon: CalendarDays },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-50">
        <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} className="flex-1">
                <button
                  className={`flex flex-col items-center justify-center w-full py-1.5 rounded-xl transition-all duration-200 ${
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-primary/10' : ''}`}>
                    <item.icon className={`h-5 w-5 ${active ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
                  </div>
                  <span className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${active ? 'opacity-100' : 'opacity-60'}`}>
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)] bg-card"></div>
      </div>
      {/* Desktop Hidden Spacer */}
      <div className="h-16 md:hidden"></div>
    </>
  );
};

export default BottomNav;

