import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  GraduationCap,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ActiveTab =
  | "dashboard"
  | "faculty"
  | "students"
  | "policies"
  | "departments"
  | "courses"
  | "calendar"
  | "analytics"
  | "audit";

interface AdminSessionSummary {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
}

interface AdminAttendanceSummary {
  totalStudents: number;
  totalSessions: number;
  averageAttendance: number;
  atRiskStudents: number;
}

interface AdminOverviewProps {
  activeTab: ActiveTab;
  sessions: AdminSessionSummary[];
  attendanceSummary?: AdminAttendanceSummary;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

function formatTabTitle(tab: ActiveTab): string {
  return tab.charAt(0).toUpperCase() + tab.slice(1).replace(/-/g, ' ');
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}) {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400';
    if (trend === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            {Icon && (
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 relative">
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {value}
            </div>
            {trendValue && (
              <div className={`flex items-center gap-1 text-sm font-medium ${getTrendColor()}`}>
                <TrendIcon className="h-4 w-4" />
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  return (
    <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>Jump straight into daily admin workflows</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {actions.map((action, index) => (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Link
                to={action.href}
                className="group flex items-center justify-between rounded-xl border border-border/40 bg-background/60 p-4 transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {action.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminOverview({
  activeTab,
  sessions,
  attendanceSummary,
  searchValue,
  onSearchChange,
}: AdminOverviewProps) {
  if (activeTab !== "dashboard") {
    return (
      <Card className="border-border/20 bg-background/60 backdrop-blur">
        <CardHeader>
          <CardTitle>{formatTabTitle(activeTab)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This module will be wired to Supabase in the next implementation step.
          </p>
        </CardContent>
      </Card>
    );
  }

  const filteredSessions = sessions.filter((session) =>
    session.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const quickActions: QuickAction[] = [
    {
      title: "Manage Students",
      description: "Review enrollment, update records, and monitor attendance compliance.",
      icon: GraduationCap,
      href: "/admin/students",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Students"
          value={attendanceSummary?.totalStudents ?? 0}
          subtitle="Enrolled and active"
          icon={Users}
          trend="up"
          trendValue="+12%"
        />
        <SummaryCard
          title="Total Sessions"
          value={attendanceSummary?.totalSessions ?? sessions.length}
          subtitle="Across all departments"
          icon={CalendarDays}
          trend="neutral"
        />
        <SummaryCard
          title="Average Attendance"
          value={`${Math.round(attendanceSummary?.averageAttendance ?? 0)}%`}
          subtitle="Institution-wide performance"
          icon={CheckCircle2}
          trend={attendanceSummary?.averageAttendance && attendanceSummary.averageAttendance >= 75 ? "up" : "down"}
          trendValue={attendanceSummary?.averageAttendance ? `${attendanceSummary.averageAttendance >= 75 ? '+' : ''}${Math.round(attendanceSummary.averageAttendance - 70)}%` : undefined}
        />
        <SummaryCard
          title="At-Risk Students"
          value={attendanceSummary?.atRiskStudents ?? 0}
          subtitle="Below 75% attendance"
          icon={AlertCircle}
          trend={attendanceSummary?.atRiskStudents && attendanceSummary.atRiskStudents > 0 ? "down" : "up"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="grid gap-4">
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Sessions
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Live attendance sessions</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  className="pl-10 border-border/40 bg-background/50 focus:bg-background transition-colors"
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredSessions.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Search className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No sessions found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting your search</p>
                  </motion.div>
                ) : (
                  filteredSessions.slice(0, 10).map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                      className="group rounded-xl border border-border/40 bg-background/60 px-4 py-3 flex items-center justify-between hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${session.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <div>
                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{session.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(session.created_at).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant={session.is_active ? "default" : "secondary"}
                        className={`text-xs font-medium ${session.is_active ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' : ''}`}
                      >
                        {session.is_active ? "Active" : "Ended"}
                      </Badge>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        <QuickActionsCard actions={quickActions} />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const location = useLocation();

  // Fetch real data from Supabase
  const { data: sessions = [] } = useQuery<AdminSessionSummary[]>({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attendanceSummary } = useQuery<AdminAttendanceSummary>({
    queryKey: ['admin-attendance-summary'],
    queryFn: async () => {
      // Get total students
      const { count: totalStudents } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // Get total sessions
      const { count: totalSessions } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });

      // Get all attendance records with status 'present' or 'late'
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('session_id, status');

      // Get all sessions
      const { data: sessionsWithAttendance } = await supabase
        .from('sessions')
        .select('id');

      // Calculate average attendance (only count present and late as attended)
      let averageAttendance = 0;
      if (sessionsWithAttendance && attendanceRecords && totalStudents) {
        const sessionCount = sessionsWithAttendance.length;
        if (sessionCount > 0) {
          // Count only 'present' and 'late' as attended
          const presentCount = attendanceRecords.filter(
            record => record.status === 'present' || record.status === 'late'
          ).length;
          const possibleAttendance = sessionCount * (totalStudents || 1);
          averageAttendance = (presentCount / possibleAttendance) * 100;
        }
      }

      // Get at-risk students (attendance < 75%)
      // Only count 'present' and 'late' as attended
      const { data: allStudentsList } = await supabase
        .from('users')
        .select('username')
        .eq('role', 'student');

      const { data: studentAttendance } = await supabase
        .from('attendance')
        .select('username, status');

      const attendanceByStudent: Record<string, number> = {};
      
      // Initialize all students with 0 attendance
      allStudentsList?.forEach(student => {
        attendanceByStudent[student.username] = 0;
      });

      // Count present and late records
      studentAttendance?.forEach(record => {
        if (record.status === 'present' || record.status === 'late') {
          attendanceByStudent[record.username] = (attendanceByStudent[record.username] || 0) + 1;
        }
      });

      const totalSessionsCount = sessionsWithAttendance?.length || 1;
      
      // Count students with attendance < 75%
      const atRiskStudents = Object.values(attendanceByStudent).filter(
        count => (count / totalSessionsCount) < 0.75
      ).length;

      return {
        totalStudents: totalStudents || 0,
        totalSessions: totalSessions || 0,
        averageAttendance: Math.round(averageAttendance),
        atRiskStudents,
      };
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AdminOverview
          activeTab={activeTab}
          sessions={sessions}
          attendanceSummary={attendanceSummary}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
      </motion.div>
    </div>
  );
}