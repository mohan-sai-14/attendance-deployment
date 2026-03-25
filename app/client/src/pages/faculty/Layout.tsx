import { useState } from "react";
import { Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/faculty/Sidebar";

export default function FacultyLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, signOut } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const displayName =
    user?.name?.trim() ||
    `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() ||
    user?.username ||
    "Faculty";

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 w-full shrink-0 border-b border-[#E5E7EB] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-lg hover:bg-[#F3F4F6]"
                onClick={toggleSidebar}
              >
                <Menu className="h-5 w-5 text-[#374151]" />
                <span className="sr-only">Toggle sidebar</span>
              </Button>
              <div>
                <h1 className="text-base font-semibold text-[#374151] sm:text-lg">Faculty portal</h1>
                <p className="hidden text-xs text-[#6B7280] sm:block">Attendance &amp; class insights</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden max-w-[140px] truncate text-sm font-medium text-[#374151] sm:inline md:max-w-[200px]">
                {displayName}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]"
                onClick={() => signOut()}
              >
                <LogOut className="mr-2 h-4 w-4 text-[#6B7280]" />
                Logout
              </Button>
              <div className="hidden h-9 w-9 shrink-0 rounded-full bg-[#ECFDF5] ring-2 ring-[#D1FAE5] sm:flex items-center justify-center">
                <span className="text-xs font-semibold text-[#059669]">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
