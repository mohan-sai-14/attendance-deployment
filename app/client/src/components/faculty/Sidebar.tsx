import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "react-router-dom";
import { X, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#111827]/20 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : -300,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ type: "tween", duration: 0.28 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#E5E7EB] bg-white p-4 shadow-sm",
          "md:relative md:translate-x-0 md:opacity-100 md:shadow-none"
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#374151]">Faculty</h2>
            <p className="text-xs text-[#6B7280]">Attendance monitor</p>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden rounded-xl hover:bg-[#F3F4F6]" onClick={onClose}>
            <X className="h-5 w-5 text-[#374151]" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        <nav className="flex-1 space-y-1">
          <NavLink
            to="/faculty"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#ECFDF5] text-[#047857] shadow-sm"
                  : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]"
              )
            }
            onClick={onClose}
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard
                  className={cn("h-5 w-5 shrink-0", isActive ? "text-[#10B981]" : "text-[#9CA3AF]")}
                />
                Dashboard
              </>
            )}
          </NavLink>
        </nav>

        <div className="mt-auto border-t border-[#E5E7EB] pt-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-[#059669] ring-1 ring-[#D1FAE5]">
              F
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#374151]">Faculty portal</p>
              <p className="truncate text-xs text-[#6B7280]">Class roster &amp; attendance</p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
