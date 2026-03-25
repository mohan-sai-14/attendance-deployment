import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Bell, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  if (!user) {
    return null;
  }

  // Mock notifications for UI example
  const notifications = [
    { id: 1, title: "Attendance recorded", time: "5 minutes ago" },
    { id: 2, title: "New session scheduled", time: "2 hours ago" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden rounded-xl hover:bg-accent transition-colors"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-8 w-8 bg-primary rounded-lg items-center justify-center text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground uppercase">
              Attendance <span className="hidden sm:inline font-medium text-muted-foreground ml-1">Portal</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Notifications */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className={`rounded-xl transition-all duration-200 ${showNotifications ? 'bg-accent text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background"></span>
              )}
            </Button>
            
            <AnimatePresence>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl bg-card border border-border py-2 z-20 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-muted/30">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Notifications</h3>
                      <Badge className="bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0">{notifications.length}</Badge>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map(notification => (
                        <div 
                          key={notification.id} 
                          className="px-4 py-3 hover:bg-accent transition-colors cursor-pointer border-b border-border last:border-0"
                        >
                          <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tight font-medium">{notification.time}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <ThemeToggle />
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center gap-2 p-1 pl-1 pr-1 sm:pr-2 rounded-xl transition-all duration-200 ${showUserMenu ? 'bg-accent' : 'hover:bg-accent'}`}
            >
              <Avatar className="h-8 w-8 rounded-lg border border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs rounded-lg">
                  {(user.name || user.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-none gap-1">
                <span className="text-xs font-bold text-foreground truncate max-w-[80px]">
                  {user.name || user.username}
                </span>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Student</span>
              </div>
            </button>
            
            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl bg-card border border-border py-1.5 z-20 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                      <p className="text-xs font-bold text-foreground truncate">
                        {user.name || user.username}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight mt-1">{user.username}</p>
                    </div>
                    <div className="p-1.5">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-xs font-semibold px-3 py-2.5 h-auto text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl"
                        onClick={signOut}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

import { Badge } from "@/components/ui/badge";
export default Header;

