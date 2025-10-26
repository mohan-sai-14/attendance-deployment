import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  QrCode, 
  ClipboardCheck, 
  FileText,
  BarChart2,
  Menu as MenuIcon,
  X,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface TeacherLayoutProps {
  children?: ReactNode;
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : 'Teacher';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "/teacher/dashboard",
    },
    {
      name: "QR Generator",
      icon: QrCode,
      href: "/teacher/qr-generator",
    },
    {
      name: "Manual Attendance",
      icon: ClipboardCheck,
      href: "/teacher/manual-attendance",
    },
    {
      name: "Attendance History",
      icon: FileText,
      href: "/teacher/attendance-history",
    },
    {
      name: "Reports",
      icon: BarChart2,
      href: "/teacher/reports",
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Close sidebar on ESC key
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (sidebarOpen && event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      {/* Backdrop Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed top-0 left-0 h-screen w-64 bg-background border-r border-border/40 z-50 flex flex-col",
          "transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
          <div 
            onClick={() => navigate('/teacher')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60">
              Teacher Panel
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.name}>
                <div
                  onClick={() => {
                    navigate(item.href);
                    if (window.innerWidth < 1024) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    "flex items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-300 cursor-pointer relative group",
                    isActive(item.href)
                      ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary font-semibold shadow-sm"
                      : "text-foreground/70 hover:bg-gradient-to-r hover:from-foreground/5 hover:to-transparent hover:text-foreground"
                  )}
                >
                  {isActive(item.href) && (
                    <motion.div 
                      layoutId="teacherActiveIndicator"
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary via-primary/80 to-primary/60 rounded-r-full shadow-lg"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <div className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300 mr-3",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-foreground/50 group-hover:bg-foreground/5 group-hover:text-foreground/80"
                  )}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span>{item.name}</span>
                  {!isActive(item.href) && (
                    <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4">
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">System Online</p>
            </div>
            <p className="text-xs text-muted-foreground">All services operational</p>
            <div className="mt-3 pt-3 border-t border-border/20">
              <p className="text-xs text-muted-foreground">
                Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <MenuIcon className="h-5 w-5" />
                </Button>
                <div className="h-8 w-px bg-border/50" />
                <h1 className="text-xl font-display font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Teacher Dashboard
                </h1>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg hover:bg-accent/50 transition-colors"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                      <span className="text-sm font-semibold text-primary">
                        {user?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </Button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl bg-background border border-border/50 overflow-hidden z-50"
                      >
                        <div className="p-2">
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm hover:bg-accent/50"
                            onClick={handleLogout}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
