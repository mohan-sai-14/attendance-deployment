import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, QrCode, FileText } from 'lucide-react';

const BottomNav: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
        <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
          <Link to="/student/dashboard">
            <button
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors ${
                isActive('/student/dashboard') || isActive('/student')
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Home className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Home</span>
            </button>
          </Link>

          <Link to="/student/scanner">
            <button
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors ${
                isActive('/student/scanner')
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <QrCode className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">Scan QR</span>
            </button>
          </Link>

          <Link to="/student/attendance-history">
            <button
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors ${
                isActive('/student/attendance-history')
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">History</span>
            </button>
          </Link>
        </div>

        <div className="pb-safe-area-inset-bottom"></div>
      </div>

      {/* Spacer to prevent content from being hidden behind the bottom bar */}
      <div className="h-20"></div>
    </>
  );
};

export default BottomNav;
