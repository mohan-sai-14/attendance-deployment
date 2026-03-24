import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, QrCode, AlertCircle, Clock, Bell, XCircle, FileText, TrendingUp, Award, BookOpen, Home } from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { format, parseISO } from 'date-fns';
import { useAuth } from "@/contexts/AuthContext";

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
  const [holidays, setHolidays] = useState<{date: string; name: string}[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [activeSessionChecked, setActiveSessionChecked] = useState<{[key: string]: boolean}>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const profileRef = React.useRef<any>(null);

  useEffect(() => {
    profileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    fetchDashboardData();
    
    // Set up interval to periodically refresh active sessions and attendance records
    const intervalId = setInterval(() => {
      fetchActiveSessions();
      refreshAttendanceRecords();
      fetchNotifications(studentClassId);
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(intervalId);
  }, [studentClassId]);

  // Check active sessions for attendance status
  useEffect(() => {
    if (todaySessions.length > 0 && attendanceRecords.length > 0) {
      const checkedMap: {[key: string]: boolean} = {};
      todaySessions.forEach((session: any) => {
        const isCheckedIn = attendanceRecords.some(
          record => record.session_id === session.id && record.status === 'present'
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

      const { data: activeSessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .in('class_id', classIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (sessionsError) {
        console.error('Error fetching active sessions:', sessionsError);
        return;
      }
      
      console.log('Active sessions refreshed:', activeSessionsData);
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

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
      } else {
        setNotifications(data || []);
      }
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  };

  const refreshAttendanceRecords = async () => {
    try {
      if (!user) return;

      console.log('Refreshing attendance records for username:', user.username);
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', user.username)
        .order('date', { ascending: false });

      if (attendanceError) {
        console.error('Error refreshing attendance records:', attendanceError);
        return;
      }

      console.log('Attendance records refreshed:', attendanceData);
      
      if (attendanceData) {
        console.log('Sample refreshed attendance record date format:', attendanceData[0]?.date);
        setAttendanceRecords(attendanceData);
        calculateStats(attendanceData);
        setRecentAttendance(attendanceData.slice(0, 5));
      } else {
        setAttendanceRecords([]);
      }
    } catch (error) {
      console.error('Error refreshing attendance records:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get current user from AuthContext
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      console.log('Current user from context:', user);

      // Fetch user profile
      console.log('Fetching user profile for username:', user.username);
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('username', user.username)
        .single();

      if (profileError) {
      }
      
      console.log('User profile:', profile);
      setUserProfile(profile);

      // Fetch attendance records - use username from context
      console.log('Fetching attendance records for username:', user.username);
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', user.username)
        .order('date', { ascending: false });

      if (attendanceError) {
        console.error('Error fetching attendance records:', attendanceError);
        return;
      }

      console.log('Fetched attendance records:', attendanceData);

      if (attendanceData) {
        console.log('Sample attendance record date format:', attendanceData[0]?.date);
        calculateStats(attendanceData);
        setRecentAttendance(attendanceData.slice(0, 5));
        setAttendanceRecords(attendanceData);
      } else {
        console.log('No attendance data found');
        setAttendanceRecords([]);
      }

      // Fetch holidays
      const { data: holidaysData } = await supabase
        .from('holidays')
        .select('date,name');
      setHolidays(holidaysData || []);

      // Fetch active sessions
      let activeSessionsData: any[] = [];
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
          const { data, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .in('class_id', classIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
            
          if (sessionsError) console.error('Error fetching active sessions:', sessionsError);
          activeSessionsData = data || [];
        }
      }
      
      console.log('Active sessions found:', activeSessionsData);
      setTodaySessions(activeSessionsData);

      // Fetch recent leave requests for activity feed
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('username', user.username)
        .order('updated_at', { ascending: false })
        .limit(10);
      setLeaveRequests(leaveData || []);

      // Fetch student class_id for notifications
      if (profile) {
        const { data: classData } = await supabase
          .from('classes')
          .select('id')
          .eq('department', profile.department)
          .eq('program', profile.program)
          .eq('year', profile.year)
          .eq('section', profile.section)
          .single();
        
        if (classData) {
          setStudentClassId(classData.id);
          fetchNotifications(classData.id);
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
    const presentCount = attendanceData.filter(a => a.status === 'present').length;
    const absentCount = attendanceData.filter(a => a.status === 'absent').length;
    const lateCount = attendanceData.filter(a => a.status === 'late').length;
    const odCount = attendanceData.filter(a => a.status === 'od').length;
    const mlCount = attendanceData.filter(a => a.status === 'ml').length;

    const attendancePercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    // Calculate current streak (consecutive days with attendance)
    let currentStreak = 0;
    const uniqueDates = [...new Set(attendanceData.map(a => a.date))].sort().reverse();

    for (const date of uniqueDates) {
      const dayAttendance = attendanceData.filter(a => a.date === date && a.status === 'present');
      if (dayAttendance.length > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    const lastAttendance = attendanceData.length > 0 ? attendanceData[0].date : null;

    setStats({
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      odCount,
      mlCount,
      attendancePercentage,
      currentStreak,
      lastAttendance
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'od': return 'bg-purple-100 text-purple-800';
      case 'ml': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <Clock className="h-4 w-4" />;
      case 'od': return <FileText className="h-4 w-4" />;
      case 'ml': return <AlertCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const getEligibility = (percentage: number) => {
    if (percentage >= 75) return { label: 'Eligible', className: 'bg-green-100 text-green-700' };
    if (percentage >= 65) return { label: 'At Risk', className: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Not Eligible', className: 'bg-red-100 text-red-700' };
  };


  const todayISO = new Date().toISOString().split('T')[0];
  const completedToday = useMemo(() => attendanceRecords.filter(r => r.date === todayISO).length, [attendanceRecords, todayISO]);
  const upcomingToday = Math.max((todaySessions?.length || 0) - completedToday, 0);

  const classesNeeded = useMemo(() => {
    const p = stats.presentCount;
    const t = stats.totalSessions;
    const needed = Math.max(0, Math.ceil(3 * t - 4 * p));
    return needed;
  }, [stats.presentCount, stats.totalSessions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        {/* Profile Strip */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-6 border border-border/40 shadow-lg">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {userProfile?.name || 'Student'}
            </h1>
            <div className="text-xs md:text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <span className="font-semibold">Registered No:</span> {userProfile?.registered_no || '—'}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">Section:</span> {userProfile?.section || '—'}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">Department:</span> {userProfile?.department || '—'}
              </span>
              <span className="flex items-center gap-1">
                <span className="font-semibold">Year:</span> {userProfile?.year || '—'}
              </span>
            </div>
          </div>
        </motion.div>
    </div>

      {/* Active Sessions Banner — pinned to top */}
      {todaySessions.length > 0 && (
        <div className="space-y-4">
          {todaySessions.map((session: any, index: number) => {
            const isCheckedIn = activeSessionChecked[session.id] || false;
            
            if (isCheckedIn) {
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  className="bg-green-500/10 border-l-4 border-green-500 p-4 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-800 dark:text-green-400">Attendance Marked</h4>
                      <p className="text-sm text-green-600 dark:text-green-500/80">You are present for {session.name}</p>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.1 }}
                className="relative overflow-hidden bg-primary/5 border border-primary/20 p-5 rounded-2xl shadow-lg ring-1 ring-primary/20"
              >
                {/* Pulse background effect */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-primary/20 animate-pulse blur-2xl"></div>
                
                <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2 border-background animate-ping"></div>
                      <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 border-2 border-background"></div>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        {session.name}
                        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 uppercase text-[10px] px-1.5 py-0">Live</Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {session.time} • Marked attendance is required
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 group shrink-0"
                    onClick={() => navigate('/student/scanner')}
                  >
                    <QrCode className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                    Scan to Check In
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overall Attendance</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-green-600 to-green-500 bg-clip-text text-transparent">{stats.attendancePercentage}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.presentCount} of {stats.totalSessions} sessions
              </p>
              <div className="mt-2">
                <Badge className={getEligibility(stats.attendancePercentage).className}>
                  {getEligibility(stats.attendancePercentage).label}
                </Badge>
              </div>
              {classesNeeded > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Attend {classesNeeded} more class{classesNeeded > 1 ? 'es' : ''} to reach 75%
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Classes Today</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-blue-500 bg-clip-text text-transparent">{todaySessions?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedToday} completed, {upcomingToday} upcoming
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

    {/* Notifications Section */}
    <div className="grid grid-cols-1 gap-6 mt-6">
      <Card className="shadow-md border-border/40 bg-card">
        <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Important Notifications
          </CardTitle>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {notifications.length} New
          </Badge>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notifications.length > 0 ? (
              notifications.map((notif: any) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 rounded-2xl border border-border/40 bg-gradient-to-br from-background to-muted/30 relative overflow-hidden group hover:shadow-lg transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 p-3">
                    <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                      <Bell className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="mb-3">
                    <h4 className="font-bold text-base text-foreground pr-8">{notif.title || 'Notification'}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Posted {format(parseISO(notif.created_at), 'MMM dd, h:mm a')}
                    </p>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed mb-4">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 w-fit px-2 py-1 rounded">
                    <Clock className="h-3 w-3" />
                    Expires: {format(parseISO(notif.expiry_time), 'MMM dd')}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <Bell className="h-10 w-10 opacity-20" />
                </div>
                <h3 className="text-lg font-semibold text-foreground/70">No active notifications</h3>
                <p className="text-sm max-w-xs mt-2 italic">When admin posts a new message, it will appear here.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
}
