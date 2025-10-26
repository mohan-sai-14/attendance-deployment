import { useLocation, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useCallback, useRef } from 'react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: string;
}

export function Sidebar({ isOpen, setIsOpen, activeTab }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Memoized close handler
  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    console.log('Closing sidebar');
    setIsOpen(false);
  }, [setIsOpen]);

  useEffect(() => {
    console.log("Sidebar isOpen state changed:", isOpen);
  }, [isOpen]);

  // Handle click outside to close sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        console.log('Click outside detected, closing sidebar');
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Add a small delay to prevent immediate closing when opening
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        console.log('ESC key pressed, closing sidebar');
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, handleClose]);

  const isActive = (path: string) => {
    if (path === "/admin" && location.pathname === "/admin") {
      return true;
    }
    return location.pathname.startsWith(path) && path !== "/admin";
  };

  const navItems = [
    { path: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { path: "/admin/students", label: "User Management", icon: <Users className="h-5 w-5" /> },
    { path: "/admin/attendance", label: "Attendance", icon: <ClipboardCheck className="h-5 w-5" /> },
  ];

  const sidebarVariants = {
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    },
    closed: {
      x: "-100%",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05,
        staggerDirection: -1
      }
    }
  };

  const itemVariants = {
    open: {
      x: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    },
    closed: {
      x: -20,
      opacity: 0,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={handleClose}
          />
          <motion.aside
            ref={sidebarRef}
            initial="closed"
            animate="open"
            exit="closed"
            variants={sidebarVariants}
            className={cn(
              "fixed left-0 top-0 bottom-0 z-40 w-[280px]",
              "border-r border-border/30 bg-background/95 backdrop-blur-md",
              "shadow-lg",
              "lg:w-64"
            )}
          >
            <div className="flex h-16 items-center justify-between border-b border-border/30 px-6 bg-gradient-to-r from-primary/5 to-transparent">
              <motion.div
                className="flex items-center gap-3"
                variants={itemVariants}
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                  <LayoutDashboard className="h-5 w-5 text-white" />
                </div>
                <span className="font-display text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60">
                  Admin Panel
                </span>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                  onClick={handleClose}
                  aria-label="Close Sidebar"
                >
                  <X className="h-5 w-5" />
                </Button>
              </motion.div>
            </div>

            <nav className="space-y-1 p-4">
              {navItems.map((item) => (
                <motion.div key={item.path} variants={itemVariants}>
                  <div
                    onClick={() => {
                      console.log('Navigation link clicked:', item.path);
                      navigate(item.path);
                      if (window.innerWidth < 1024) {
                        console.log('Closing sidebar on mobile');
                        handleClose();
                      }
                    }}
                    className={cn(
                      "relative group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 cursor-pointer",
                      isActive(item.path)
                        ? "bg-gradient-to-r from-primary/15 via-primary/10 to-transparent text-primary font-semibold shadow-sm"
                        : "text-foreground/70 hover:bg-gradient-to-r hover:from-foreground/5 hover:to-transparent hover:text-foreground"
                    )}
                  >
                    {isActive(item.path) && (
                      <motion.div 
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary via-primary/80 to-primary/60 rounded-r-full shadow-lg"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}

                    <div className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-300",
                      isActive(item.path)
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-foreground/50 group-hover:bg-foreground/5 group-hover:text-foreground/80"
                    )}>
                      {item.icon}
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                    
                    {/* Hover indicator */}
                    {!isActive(item.path) && (
                      <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </nav>

            <motion.div
              variants={itemVariants}
              className="absolute bottom-6 left-0 right-0 px-4"
            >
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 shadow-sm">
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
            </motion.div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Add default export
export default Sidebar;
