import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  QrCode, 
  ClipboardCheck, 
  Users, 
  FileText,
  X,
  BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useCallback } from 'react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  userRole: string;
}

export function Sidebar({ isOpen, setIsOpen, userRole }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Log state changes for debugging
  useEffect(() => {
    console.log("Teacher Sidebar isOpen state changed:", isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, setIsOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const isActive = (path: string) => {
    if (path === "/teacher" && location.pathname === "/teacher") {
      return true;
    }
    return location.pathname.startsWith(path) && path !== "/teacher";
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

  return (
    <>
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-screen w-64 bg-background border-r border-border/40 z-50 flex flex-col",
          "transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
          <div 
            onClick={() => navigate('/teacher/dashboard')}
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
            onClick={handleClose}
            className="lg:hidden rounded-full hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
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
                      handleClose();
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
    </>
  );
}
