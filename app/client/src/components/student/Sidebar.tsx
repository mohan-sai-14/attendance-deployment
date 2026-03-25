import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard,
  QrCode,
  History,
  X,
  Calendar,
  ShieldCheck,
  ChevronRight,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  userRole: string;
}

export function Sidebar({ isOpen, setIsOpen, userRole }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const isActive = (path: string) => {
    if (path === "/student/dashboard" && location.pathname === "/student") return true;
    return location.pathname === path;
  };

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard, href: "/student/dashboard" },
    { name: "Scan QR Code", icon: QrCode, href: "/student/scanner" },
    { name: "Attendance History", icon: History, href: "/student/attendance-history" },
    { name: "Timetable", icon: Calendar, href: "/student/timetable" },
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
            className="fixed inset-0 bg-[#374151]/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed top-0 left-0 h-screen w-72 bg-white border-r border-[#E5E7EB] z-50 flex flex-col shadow-xl lg:shadow-none",
          "lg:relative lg:translate-x-0 lg:z-auto"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F3F4F6]">
          <div 
            onClick={() => navigate('/student/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="h-10 w-10 rounded-xl bg-[#374151] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-foreground tracking-tight leading-none">
                Student Portal
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="lg:hidden rounded-xl hover:bg-gray-100 transition-all duration-200"
          >
            <X className="h-5 w-5 text-gray-400" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          <div>
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Main Menu</p>
            <ul className="space-y-1.5">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.name}>
                    <button
                      onClick={() => {
                        navigate(item.href);
                        if (window.innerWidth < 1024) handleClose();
                      }}
                      className={cn(
                        "w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                        active
                          ? "bg-[#10B981]/5 text-[#10B981] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]"
                          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 mr-3",
                        active ? "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600"
                      )}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold tracking-tight">{item.name}</span>
                      {active && (
                        <ChevronRight className="absolute right-3 h-4 w-4 opacity-100" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Account Footer */}
        <div className="p-4 mt-auto border-t border-[#F3F4F6] bg-gray-50/50">
           <Button 
            variant="ghost" 
            onClick={signOut}
            className="w-full justify-start gap-3 h-12 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 font-bold text-sm"
          >
            <div className="h-8 w-8 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
               <LogOut className="h-4 w-4" />
            </div>
            Sign Out
          </Button>
        </div>
      </motion.aside>
    </>
  );
}

