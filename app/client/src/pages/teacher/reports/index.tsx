import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, BarChart2, LineChart, PieChart, Calendar, Loader2, TrendingUp, Users, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Reports() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    averageAttendance: 0,
    totalSessions: 0
  });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setIsLoading(true);

      // Get total students
      const { count: totalStudents } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // Get total sessions
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await supabase
        .from('attendance')
        .select('*')
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`);

      // Calculate average attendance
      let totalAttendanceRate = 0;
      const sessionsWithAttendance = await Promise.all(
        (sessions || []).slice(0, 10).map(async (session) => {
          const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', session.id);

          const presentCount = attendance?.length || 0;
          const rate = totalStudents ? Math.round((presentCount / totalStudents) * 100) : 0;
          totalAttendanceRate += rate;

          return {
            ...session,
            presentCount,
            totalStudents: totalStudents || 0,
            rate
          };
        })
      );

      const avgAttendance = sessions?.length 
        ? Math.round(totalAttendanceRate / Math.min(sessions.length, 10))
        : 0;

      setStats({
        totalStudents: totalStudents || 0,
        presentToday: todayAttendance?.length || 0,
        averageAttendance: avgAttendance,
        totalSessions: sessions?.length || 0
      });

      setRecentSessions(sessionsWithAttendance.slice(0, 5));
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            View and analyze attendance reports
          </p>
        </div>
        <Button onClick={fetchReportsData} className="shadow-lg hover:shadow-xl transition-shadow">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered students</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Present Today</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{stats.presentToday}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalStudents > 0 
                  ? `${Math.round((stats.presentToday / stats.totalStudents) * 100)}% of total`
                  : 'No data'}
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
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Attendance</CardTitle>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{stats.averageAttendance}%</div>
              <p className="text-xs text-muted-foreground mt-1">Across all sessions</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{stats.totalSessions}</div>
              <p className="text-xs text-muted-foreground mt-1">All time sessions</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Chart Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}>
        <Card className="col-span-full border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-primary" />
                  Attendance Overview
                </CardTitle>
                <CardDescription className="mt-1">Recent session attendance rates</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchReportsData} className="border-border/40">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {recentSessions.length > 0 ? (
              <div className="h-full flex items-end justify-around gap-2 px-4">
                {recentSessions.map((session, index) => {
                  const maxHeight = 250;
                  const barHeight = (session.rate / 100) * maxHeight;
                  const isGood = session.rate >= 75;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col items-center justify-end h-[250px]">
                        <div className="text-xs font-medium mb-1">{session.rate}%</div>
                        <div 
                          className={`w-full rounded-t-lg transition-all duration-500 ${
                            isGood ? 'bg-green-500' : 'bg-orange-500'
                          } hover:opacity-80 cursor-pointer relative group`}
                          style={{ height: `${barHeight}px`, minHeight: '20px' }}
                        >
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {session.presentCount}/{session.totalStudents} students
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-center text-muted-foreground max-w-[80px] truncate">
                        {session.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-muted/30 rounded-xl border border-border/40">
                <BarChart2 className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No attendance data available</p>
                <p className="text-xs text-muted-foreground mt-1">Create sessions to see analytics</p>
              </div>
            )}
          </div>
          
          {/* Legend */}
          {recentSessions.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm text-muted-foreground">Good (≥75%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500"></div>
                <span className="text-sm text-muted-foreground">Needs Improvement (&lt;75%)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>

      {/* Bottom Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Recent Sessions
              </CardTitle>
              <CardDescription>Latest attendance sessions</CardDescription>
            </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.length > 0 ? (
                recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(session.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {session.presentCount}/{session.totalStudents}
                      </p>
                      <p className={`text-sm ${session.rate >= 75 ? 'text-green-600' : 'text-orange-600'}`}>
                        {session.rate}% present
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sessions found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}>
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Session Statistics
              </CardTitle>
              <CardDescription>Attendance rate breakdown</CardDescription>
            </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSessions.length > 0 ? (
                recentSessions.slice(0, 4).map((session, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="truncate max-w-[150px]">{session.name}</span>
                      <span>{session.rate}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${session.rate >= 75 ? 'bg-green-500' : 'bg-orange-500'}`}
                        style={{ width: `${session.rate}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  );
}
