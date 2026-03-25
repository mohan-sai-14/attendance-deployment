import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  QrCode, 
  Clock, 
  Bell, 
  Users, 
  TrendingUp, 
  BookOpen, 
  Calendar, 
  ChevronRight,
  ShieldCheck,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { format, parseISO } from 'date-fns';
import { useAuth } from "@/contexts/AuthContext";
import { SubjectAttendance } from "@/components/student/SubjectAttendance";
import { cn } from "@/lib/utils";




interface AttendanceStats {
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  odCount: number;
  mlCount: number;
  attendancePercentage: number;
  currentStreak: number;
  lastAttendance: string | null;
}

interface RecentAttendance {
  id: string;
  date: string;
  session_name: string;
  status: 'present' | 'absent' | 'late' | 'od' | 'ml';
  check_in_time: string;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<AttendanceStats>({
    totalSessions: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    odCount: 0,
    mlCount: 0,
    attendancePercentage: 0,
    currentStreak: 0,
    lastAttendance: null
  });

  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeSessionChecked, setActiveSessionChecked] = useState<{ [key: string]: boolean }>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const profileRef = React.useRef<any>(null);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    fetchDashboardData();
    const intervalId = setInterval(() => {
      fetchActiveSessions();
      refreshAttendanceRecords();
      fetchNotifications(studentClassId);
    }, 10000);
    return () => clearInterval(intervalId);
  }, [studentClassId]);

  useEffect(() => {
    if (todaySessions.length > 0 && attendanceRecords.length > 0) {
      const checkedMap: { [key: string]: boolean } = {};
      todaySessions.forEach((session: any) => {
        const isCheckedIn = attendanceRecords.some(
          record => record.session_id === session.id && (record.status === 'present' || record.status === 'Present')
        );
        checkedMap[session.id] = isCheckedIn;
      });
      setActiveSessionChecked(checkedMap);
    }
  }, [todaySessions, attendanceRecords]);

  const fetchActiveSessions = async () => {
    try {
      const profile = profileRef.current;
      if (!profile) return;
      const { data: matchingClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('department', profile.department)
        .eq('program', profile.program)
        .eq('year', profile.year)
        .eq('section', profile.section);
      const classIds = (matchingClasses || []).map(c => c.id);
      if (classIds.length === 0) {
        setTodaySessions([]);
        return;
      }
      const { data: activeSessionsData } = await supabase
        .from('sessions')
        .select('*')
        .in('class_id', classIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setTodaySessions(activeSessionsData || []);
    } catch (error) {
      console.error('Error refreshing active sessions:', error);
    }
  };

  const fetchNotifications = async (classId?: string | null) => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .gt('expiry_time', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (classId) {
        query = query.or(`class_id.is.null,class_id.eq.${classId}`);
      } else {
        query = query.is('class_id', null);
      }
      const { data } = await query;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  };

  const refreshAttendanceRecords = async () => {
    if (!user) return;
    try {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', user.username)
        .order('date', { ascending: false });
      if (attendanceData) {
        setAttendanceRecords(attendanceData);
        calculateStats(attendanceData);
        setRecentAttendance(attendanceData.slice(0, 5));
      }
    } catch (error) {
      console.error('Error refreshing attendance records:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      if (!user) return;
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('username', user.username)
        .single();
      setUserProfile(profile);
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', user.username)
        .order('date', { ascending: false });
      if (attendanceData) {
        calculateStats(attendanceData);
        setRecentAttendance(attendanceData.slice(0, 5));
        setAttendanceRecords(attendanceData);
      }
      if (profile) {
        const { data: matchingClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('department', profile.department)
          .eq('program', profile.program)
          .eq('year', profile.year)
          .eq('section', profile.section);
        const classIds = (matchingClasses || []).map(c => c.id);
        if (classIds.length > 0) {
          const { data: activeSessionsData } = await supabase
            .from('sessions')
            .select('*')
            .in('class_id', classIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
          setTodaySessions(activeSessionsData || []);
          const studentClass = matchingClasses ? matchingClasses[0] : null;
          if (studentClass) {
            setStudentClassId(studentClass.id);
            fetchNotifications(studentClass.id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (attendanceData: any[]) => {
    const totalSessions = attendanceData.length;
    const presentCount = attendanceData.filter(a => ['present', 'Present', 'late', 'od', 'ml'].includes(a.status)).length;
    const absentCount = attendanceData.filter(a => a.status === 'absent' || a.status === 'Absent').length;
    const lateCount = attendanceData.filter(a => a.status === 'late').length;
    const odCount = attendanceData.filter(a => a.status === 'od').length;
    const mlCount = attendanceData.filter(a => a.status === 'ml').length;
    const attendancePercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
    let currentStreak = 0;
    const uniqueDates = [...new Set(attendanceData.map(a => a.date))].sort().reverse();
    for (const date of uniqueDates) {
      const dayAttendance = attendanceData.filter(a => a.date === date && ['present', 'Present'].includes(a.status));
      if (dayAttendance.length > 0) currentStreak++; else break;
    }
    const lastAttendance = attendanceData.length > 0 ? attendanceData[0].date : null;
    setStats({ totalSessions, presentCount, absentCount, lateCount, odCount, mlCount, attendancePercentage, currentStreak, lastAttendance });
  };

  const getEligibility = (percentage: number) => {
    if (percentage >= 75) return { label: 'Eligible', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle };
    if (percentage >= 65) return { label: 'At Risk', color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock };
    return { label: 'Not Eligible', color: 'text-rose-600', bg: 'bg-rose-50', icon: ShieldCheck };
  };

  const classesNeeded = useMemo(() => {
    const p = stats.presentCount;
    const t = stats.totalSessions;
    if (t === 0) return 0;
    // (p + x) / (t + x) >= 0.75  => p + x >= 0.75t + 0.75x => 0.25x >= 0.75t - p => x >= 3t - 4p
    const needed = Math.max(0, Math.ceil(3 * t - 4 * p));
    return needed;
  }, [stats.presentCount, stats.totalSessions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest animate-pulse">Initializing Portal...</p>
      </div>
    );
  }

  const eligibility = getEligibility(stats.attendancePercentage);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-0 text-[10px] uppercase font-bold px-2">Student</Badge>
             <span className="text-border">•</span>
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{userProfile?.section || '--'} Section</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Hi, {userProfile?.name?.split(' ')[0] || 'there'}! {"\u{1F44B}"}
          </h1>
          <p className="text-gray-500 font-medium">Here's your academic summary for today.</p>
        </div>
        
        <div className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border shadow-sm">
           <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
              <Zap className="h-6 w-6 fill-current" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Attendance Streak</p>
              <p className="text-xl font-bold text-foreground">{stats.currentStreak} Days</p>
           </div>
        </div>
      </section>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Main Card */}
        <Card className="lg:col-span-2 border-border shadow-sm bg-card rounded-2xl overflow-hidden group">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold text-foreground">Overall Attendance</CardTitle>
                <CardDescription className="text-sm font-medium">Tracking your 75% eligibility goal</CardDescription>
              </div>
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm border", eligibility.bg, eligibility.color, "border-current/10")}>
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-6xl font-black tracking-tighter", eligibility.color)}>{stats.attendancePercentage}%</span>
              <span className="text-lg font-bold text-muted-foreground">/ 100%</span>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-gray-500">Progress to Goal</span>
                <span className={eligibility.color}>{stats.attendancePercentage}% / 75%</span>
              </div>
              <Progress value={Math.min(100, stats.attendancePercentage * 1.33)} className="h-3 bg-gray-100" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total</p>
                 <p className="text-xl font-bold text-foreground">{stats.totalSessions}</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                 <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 text-emerald-600">Present</p>
                 <p className="text-xl font-bold text-emerald-700">{stats.presentCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
                 <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 text-rose-600">Absent</p>
                 <p className="text-xl font-bold text-rose-700">{stats.absentCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 text-gray-600">Check-in</p>
                 <p className="text-xl font-bold text-gray-700">{stats.lastAttendance ? format(parseISO(stats.lastAttendance), 'MMM dd') : '--'}</p>
              </div>
            </div>

            <div className={cn("flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border border-dashed", eligibility.color, eligibility.bg, "border-current/20")}>
              <div className="flex items-center gap-3 mb-4 sm:mb-0">
                <eligibility.icon className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-wide">Status: {eligibility.label}</span>
              </div>
              {classesNeeded > 0 ? (
                <p className="text-xs font-semibold">Attend <span className="underline decoration-2">{classesNeeded}</span> more classes to secure 75%</p>
              ) : (
                <p className="text-xs font-semibold text-emerald-600">Goal achieved! Keep it up. ✨</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Live Session */}
        <div className="space-y-6">
          {/* Active Session Card */}
          <AnimatePresence>
            {todaySessions.length > 0 && todaySessions.map((session) => {
              const isCheckedIn = activeSessionChecked[session.id];
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "relative overflow-hidden p-6 rounded-2xl border transition-all duration-300 shadow-lg",
                    isCheckedIn 
                      ? "bg-emerald-50 border-emerald-200" 
                      : "bg-[#374151] border-gray-700 text-white shadow-[#374151]/20"
                  )}
                >
                  {!isCheckedIn && (
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-emerald-500 opacity-20 blur-3xl animate-pulse"></div>
                  )}
                  
                  <div className="flex items-start justify-between mb-8">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded", isCheckedIn ? "bg-emerald-200 text-emerald-800" : "bg-emerald-500 text-white")}>Live Now</span>
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{session.time}</span>
                      </div>
                      <h4 className="text-xl font-extrabold tracking-tight">{session.name}</h4>
                    </div>
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", isCheckedIn ? "bg-emerald-100 text-emerald-600" : "bg-card/10 text-emerald-400 border border-white/10")}>
                      {isCheckedIn ? <CheckCircle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                    </div>
                  </div>

                  {isCheckedIn ? (
                    <div className="flex items-center gap-3 text-emerald-800 font-bold text-sm">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      Attendance Marked
                    </div>
                  ) : (
                    <Button 
                      onClick={() => navigate('/student/scanner')}
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <QrCode className="h-5 w-5 mr-3" />
                      Scan QR Code
                    </Button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Quick Stats Overlay Card */}
          <Card className="border-border shadow-sm bg-card rounded-2xl p-6">
            <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">Daily Overview</h5>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Timetable Access</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">View Full Schedule</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => navigate('/student/timetable')} className="text-emerald-500 hover:bg-emerald-50 rounded-lg">
                   <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subject wise breakdown */}
        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                 <BookOpen className="h-5 w-5 text-[#10B981]" />
                 Academic Breakdown
              </h3>
              <Button 
                variant="link" 
                onClick={() => navigate('/student/subjects-attendance')}
                className="text-xs font-bold text-[#10B981] uppercase tracking-wider p-0 h-auto hover:no-underline"
              >
                Details <ArrowUpRight className="h-3 w-3 inline ml-1" />
              </Button>
           </div>
           <SubjectAttendance records={attendanceRecords} />
        </section>

        {/* Recent Notifications */}
        <section className="space-y-4">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
                 <Bell className="h-5 w-5 text-[#10B981]" />
                 Activity Feed
              </h3>
              <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-0 text-[10px] font-bold px-2">{notifications.length}</Badge>
           </div>
           
           <div className="space-y-4">
              {notifications.length > 0 ? (
                notifications.map((notif, idx) => (
                  <motion.div 
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-5 bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-xl bg-[#F9FAFB] border border-border flex items-center justify-center text-amber-500 shrink-0 group-hover:bg-[#374151] group-hover:text-white transition-colors duration-300">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm text-foreground truncate group-hover:text-emerald-600 transition-colors">{notif.title}</h4>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase shrink-0 ml-2">{format(parseISO(notif.created_at), 'HH:mm')}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-500 leading-relaxed line-clamp-2">{notif.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-muted-foreground mb-3">
                    <Bell className="h-6 w-6" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Recent Activity</p>
                </div>
              )}
           </div>
        </section>
      </div>

      {/* Footer Branding */}
      <footer className="pt-8 pb-4 flex flex-col items-center justify-center gap-4 text-center border-t border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">© 2024 TU Attendance System • Academic Continuity Office</p>
      </footer>
    </div>
  );
}

