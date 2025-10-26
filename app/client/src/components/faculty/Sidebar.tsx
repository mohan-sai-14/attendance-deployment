import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { X, LayoutDashboard, Users, Calendar, FileText, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    name: "Dashboard",
    path: "/faculty",
    icon: LayoutDashboard,
  },
  {
    name: "Sessions",
    path: "/faculty/sessions",
    icon: QrCode,
  },
  {
    name: "Students",
    path: "/faculty/students",
    icon: Users,
  },
  {
    name: "Schedule",
    path: "/faculty/schedule",
    icon: Calendar,
  },
  {
    name: "Reports",
    path: "/faculty/reports",
    icon: FileText,
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300, opacity: 0 }}
        animate={{
          x: isOpen ? 0 : -300,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ type: "tween", duration: 0.3 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-border/20 bg-background/95 backdrop-blur-md p-4 flex flex-col",
          "md:relative md:translate-x-0 md:border-r"
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold">Faculty Portal</h2>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={onClose}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-border/20">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {location.pathname
                  .split("/")
                  .filter(Boolean)
                  .map((s) => s.charAt(0).toUpperCase())
                  .join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Faculty Member</p>
              <p className="text-xs text-muted-foreground truncate">
                {location.pathname.split("/").filter(Boolean).join(" ") || "Dashboard"}
              </p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
