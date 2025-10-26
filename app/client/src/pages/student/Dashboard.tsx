import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, QrCode, AlertCircle, Clock, Bell, XCircle, FileText, TrendingUp, Award, BookOpen, Home, Flame } from 'lucide-react';
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

  useEffect(() => {
    fetchDashboardData();
    
    // Set up interval to periodically refresh active sessions and attendance records
    const intervalId = setInterval(() => {
      fetchActiveSessions();
      refreshAttendanceRecords();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(intervalId);
  }, []);

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
      const { data: activeSessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
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
      const { data: activeSessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (sessionsError) {
        console.error('Error fetching active sessions:', sessionsError);
      }
      
      console.log('Active sessions found:', activeSessionsData);
      setTodaySessions(activeSessionsData || []);

      // Fetch recent leave requests for activity feed
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('username', user.email)
        .order('updated_at', { ascending: false })
        .limit(10);
      setLeaveRequests(leaveData || []);

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

  const calendarModifiers = useMemo(() => {
    const dateMap = new Map<string, Set<string>>();
    attendanceRecords.forEach((r) => {
      if (!dateMap.has(r.date)) dateMap.set(r.date, new Set());
      dateMap.get(r.date)!.add(r.status);
    });
    const present: Date[] = [];
    const absent: Date[] = [];
    const od: Date[] = [];
    const ml: Date[] = [];
    dateMap.forEach((statuses, dateStr) => {
      if (statuses.has('present')) present.push(new Date(dateStr));
      else if (statuses.has('od')) od.push(new Date(dateStr));
      else if (statuses.has('ml')) ml.push(new Date(dateStr));
      else if (statuses.has('absent')) absent.push(new Date(dateStr));
    });
    const holiday = holidays.map(h => new Date(h.date));
    return { present, absent, od, ml, holiday } as const;
  }, [attendanceRecords, holidays]);

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

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-orange-600 to-orange-500 bg-clip-text text-transparent">{stats.currentStreak}</div>
              <p className="text-xs text-muted-foreground mt-1">
                consecutive days
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
    </div>

    {/* Active Sessions Card */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}>
      <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Active Sessions
          </CardTitle>
          <CardDescription>Mark your attendance for active sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaySessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-4 mx-auto border border-border/40">
                <Clock className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold text-muted-foreground mb-2">
                No active sessions
              </p>
              <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto">
                There are no active sessions at the moment. Check back later.
              </p>
            </div>
          ) : (
            todaySessions.map((session: any, index: number) => {
              const isCheckedIn = activeSessionChecked[session.id] || false;
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-border/40 rounded-xl p-4 bg-gradient-to-r from-background to-background/50 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-lg">{session.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {session.time}
                      </p>
                      <p className="text-xs text-muted-foreground">{session.date}</p>
                    </div>

                    {isCheckedIn ? (
                      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-700 dark:text-green-400">Checked In!</p>
                          <p className="text-sm text-green-600 dark:text-green-500">Attendance marked</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="h-6 w-6 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-orange-700 dark:text-orange-400">Attendance Needed!</p>
                            <p className="text-sm text-muted-foreground">
                              Mark your attendance for this active session.
                            </p>
                          </div>
                        </div>
                        <Button
                          className="w-full bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-shadow"
                        onClick={() => navigate('/student/scanner')}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Scan QR Code
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
    </motion.div>

    {/* Calendar & Live Sessions */}
    <div id="calendarSection" className="grid grid-cols-1 gap-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-green-200 text-green-800">Present</span>
            <span className="px-2 py-0.5 rounded bg-red-200 text-red-800">Absent</span>
            <span className="px-2 py-0.5 rounded bg-yellow-200 text-yellow-800">OD</span>
            <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-800">ML</span>
            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-800">Holiday</span>
          </div>
          <CalendarUI
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            modifiers={calendarModifiers}
            modifiersClassNames={{
              present: 'bg-green-200 text-green-900',
              absent: 'bg-red-200 text-red-900',
              od: 'bg-yellow-200 text-yellow-900',
              ml: 'bg-blue-200 text-blue-900',
              holiday: 'bg-amber-200 text-amber-800'
            }}
          />
          {selectedDate && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-medium border-b pb-2">
                {selectedDate.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'short', day:'numeric' })}
              </h4>
              {(() => {
                // Create date string from local date components to avoid timezone issues
                const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
                console.log('Selected date (YYYY-MM-DD):', selectedDateStr);

                // Enhanced debugging for date comparison
                console.log('=== DATE DEBUGGING ===');
                console.log('Selected date object:', selectedDate);
                console.log('Selected date ISO:', selectedDate.toISOString());
                console.log('Selected date string:', selectedDateStr);
                console.log('Selected date local:', selectedDate.toLocaleDateString());
                console.log('Selected date components:', {
                  year: selectedDate.getFullYear(),
                  month: selectedDate.getMonth(),
                  date: selectedDate.getDate(),
                  hours: selectedDate.getHours(),
                  timezone: selectedDate.getTimezoneOffset()
                });
                console.log('Attendance records count:', attendanceRecords.length);

                // Log all attendance record dates
                attendanceRecords.forEach((record, index) => {
                  console.log(`Record ${index}:`, {
                    id: record.id,
                    date: record.date,
                    session_name: record.session_name,
                    raw_date: record.date
                  });
                });

                // Helper function to normalize dates for comparison
                const normalizeDate = (dateStr: string) => {
                  if (!dateStr) return null;

                  console.log('Normalizing date:', dateStr);

                  // If it's a timestamp like "2025-10-01T20:33:52", extract just the date part
                  if (dateStr.includes('T')) {
                    const datePart = dateStr.split('T')[0];
                    console.log('Extracted date from timestamp:', datePart);
                    return datePart;
                  }

                  // If already in YYYY-MM-DD format
                  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return dateStr;
                  }

                  // If in DD-MM-YYYY format, convert to YYYY-MM-DD
                  if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                      return `${parts[2]}-${parts[1]}-${parts[0]}`;
                    }
                  }

                  // Try parsing as Date object and return YYYY-MM-DD
                  try {
                    const dateObj = new Date(dateStr);
                    if (!isNaN(dateObj.getTime())) {
                      return dateObj.toISOString().split('T')[0];
                    }
                  } catch (e) {
                    console.warn('Failed to parse date:', dateStr);
                  }

                  return null;
                };

                const dayAttendance = attendanceRecords.filter(r => {
                  const normalizedRecordDate = normalizeDate(r.date);
                  const normalizedSelectedDate = selectedDateStr;

                  console.log(`Comparing: ${normalizedRecordDate} vs ${normalizedSelectedDate}`);
                  return normalizedRecordDate === normalizedSelectedDate;
                });

                console.log('Final filtered attendance for', selectedDateStr, ':', dayAttendance);
                
                if (dayAttendance.length === 0) {
                  return (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No attendance records for this date.</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    {dayAttendance.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-accent/5 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{r.session_name}</p>
                          <p className="text-xs text-muted-foreground">{r.check_in_time || 'Time not recorded'}</p>
                        </div>
                        <Badge className={getStatusColor(r.status)}>{r.status.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
);
}
