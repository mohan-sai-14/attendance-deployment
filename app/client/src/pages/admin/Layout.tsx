import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/admin/sidebar';
import { Button } from '@/components/ui/button';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : 'Admin';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Determine active tab based on current route
  const getActiveTab = (pathname: string) => {
    if (pathname.includes('/dashboard')) return 'dashboard';
    if (pathname.includes('/students')) return 'students';
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/attendance')) return 'attendance';
    if (pathname.includes('/roles')) return 'roles';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/audit')) return 'audit';
    return 'dashboard';
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeTab={getActiveTab(location.pathname)}
      />
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
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="h-8 w-px bg-border/50" />
                <h1 className="text-xl font-display font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Admin Dashboard
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
