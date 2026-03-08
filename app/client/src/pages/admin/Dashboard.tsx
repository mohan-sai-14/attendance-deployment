import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileBarChart,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Types
interface RecentSession {
  id: string;
  class_id: string;
  class_label: string;
  period_number: number;
  subject: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  percentage: number;
  date: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecentSessions();
  }, []);

  const fetchRecentSessions = async () => {
    setIsLoading(true);
    try {
      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (attError) throw attError;

      const { data: classesData } = await supabase.from('classes').select('*');
      const classesMap = new Map((classesData || []).map(c => [c.id, c]));

      const { data: ttData } = await supabase.from('timetables').select('*');

      const groupKey = (a: any) => `${a.class_id}__${a.date}__${a.period_number}`;
      const groups: Record<string, any[]> = {};

      for (const record of (attData || [])) {
        if (!record.class_id || !record.date || !record.period_number) continue;
        const key = groupKey(record);
        if (!groups[key]) groups[key] = [];
        groups[key].push(record);
      }

      const sessions: RecentSession[] = [];

      for (const [key, records] of Object.entries(groups)) {
        const [classId, date, periodStr] = key.split('__');
        const periodNumber = parseInt(periodStr);
        const cls = classesMap.get(classId);

        const classLabel = cls
          ? `${cls.department} – ${cls.program} ${cls.year} – ${cls.section}`
          : classId;

        const ttSlot = (ttData || []).find(
          (tt: any) => tt.class_id === classId && tt.period_number === periodNumber
        );
        const subject = ttSlot?.subject_name || '—';

        const presentCount = records.filter((r: any) => r.status === 'present').length;
        const absentCount = records.filter((r: any) => r.status === 'absent').length;
        const totalStudents = presentCount + absentCount;
        const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

        sessions.push({
          id: key,
          class_id: classId,
          class_label: classLabel,
          period_number: periodNumber,
          subject,
          total_students: totalStudents,
          present_count: presentCount,
          absent_count: absentCount,
          percentage,
          date,
        });
      }

      sessions.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.period_number - a.period_number;
      });

      setRecentSessions(sessions.slice(0, 10));
    } catch (error) {
      console.error("Error fetching recent sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Color configs for each card
  const actionCards = [
    {
      title: "Manual Attendance",
      description: "Mark or correct attendance within 48hrs. Mandatory reason for each change.",
      icon: ClipboardCheck,
      href: "/admin/attendance",
      cta: "Go to Attendance",
      isPrimary: false,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10 group-hover:bg-violet-500/20",
    },
    {
      title: "Manage Students",
      description: "Add, edit, assign department/year/section. View individual attendance %.",
      icon: GraduationCap,
      href: "/admin/students",
      cta: "Manage Students",
      isPrimary: false,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 group-hover:bg-blue-500/20",
    },
    {
      title: "Manage Timetables",
      description: "Create timetables, assign subjects & faculty. Detect clashes.",
      icon: CalendarDays,
      href: "/admin/timetables",
      cta: "Manage Timetables",
      isPrimary: false,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 group-hover:bg-emerald-500/20",
    },
    {
      title: "Faculty Timetable",
      description: "View and manage faculty-wise timetables auto-generated from class schedules.",
      icon: FileBarChart,
      href: "/admin/faculty",
      cta: "View Faculty",
      isPrimary: false,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 group-hover:bg-amber-500/20",
    },
  ];

  const getPercentageColor = (pct: number) => {
    if (pct >= 85) return "text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20";
    if (pct >= 65) return "text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
      {/* Page Header — compact */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Control Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Take action or review what just happened.</p>
      </div>

      {/* SECTION 1: ACTION CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {actionCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.06 }}
          >
            <Card
              onClick={() => navigate(card.href)}
              className={`group cursor-pointer flex flex-col h-full border-border/40 bg-background/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${card.isPrimary ? "ring-1 ring-primary/30 border-primary/20" : ""
                }`}
            >
              {card.isPrimary && (
                <div className="h-0.5 bg-primary" />
              )}
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${card.bg} ${card.color}`}>
                    <card.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
                      {card.title}
                    </CardTitle>
                    {card.isPrimary && (
                      <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">Priority</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between px-4 pb-4 pt-1">
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {card.description}
                </p>
                <div className="flex items-center text-xs font-medium text-primary/80 group-hover:text-primary transition-colors">
                  {card.cta}
                  <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* SECTION 2: RECENT SESSIONS */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.3 }}
      >
        <Card className="border-border/40 bg-background/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-border/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recent Attendance Sessions
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary px-2" onClick={() => navigate('/admin/attendance')}>
                View All <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground/70">
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-sm">No sessions recorded yet. Sessions appear here once attendance is taken.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 text-muted-foreground">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">Class</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider w-16">Period</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider w-14">Total</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider w-16">Present</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider w-16">Absent</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider w-20">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {recentSessions.map((session, index) => (
                      <tr
                        key={session.id}
                        className="group hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => navigate('/admin/attendance')}
                      >
                        <td className="px-5 py-2.5">
                          <span className="font-medium text-sm text-foreground">{session.class_label}</span>
                          <span className="ml-2 text-[11px] text-muted-foreground">{session.date}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center justify-center h-6 w-8 rounded bg-muted/50 text-xs font-semibold">{session.period_number}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-sm">{session.subject}</td>
                        <td className="px-4 py-2.5 text-center font-medium text-sm">{session.total_students}</td>
                        <td className="px-4 py-2.5 text-center font-medium text-green-600 dark:text-green-400 text-sm">{session.present_count}</td>
                        <td className="px-4 py-2.5 text-center font-medium text-red-600 dark:text-red-400 text-sm">{session.absent_count}</td>
                        <td className="px-5 py-2.5 text-right">
                          <Badge className={`${getPercentageColor(session.percentage)} text-xs font-bold px-2 py-0`}>
                            {session.percentage}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
