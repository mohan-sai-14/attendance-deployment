import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Eye, CheckCircle, XCircle, Filter, X, CalendarDays, TrendingUp, Users, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Attendance() {
  const [sessionFilter, setSessionFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sessionStats, setSessionStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [presentStudents, setPresentStudents] = useState<any[]>([]);
  const [absentStudents, setAbsentStudents] = useState<any[]>([]);

  // Fetch all sessions and attendance data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (sessionsError) throw sessionsError;
        
        // Fetch all students to get accurate count
        const { data: allStudents, error: studentsError } = await supabase
          .from('users')
          .select('id, username')
          .eq('role', 'student');
          
        if (studentsError) throw studentsError;
        
        const studentsCount = allStudents?.length || 0;
        
        // Fetch attendance stats for each session
        const sessionsWithStats = await Promise.all(
          (sessions || []).map(async (session) => {
            try {
              const { data: attendance, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('session_id', session.id);
                
              if (attendanceError) throw attendanceError;
              
              // Count only records with status 'present' or 'late' as present
              const presentCount = attendance ? attendance.filter(a => 
                a.status === 'present' || a.status === 'late'
              ).length : 0;
              
              // Count records with status 'absent' as absent (not total students - present)
              const absentCount = attendance ? attendance.filter(a => 
                a.status === 'absent'
              ).length : 0;
              
              const totalRecorded = presentCount + absentCount;
              const attendanceRate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;
              
              return {
                ...session,
                present: presentCount,
                absent: absentCount,
                percentage: attendanceRate,
                totalStudents: studentsCount || 0
              };
            } catch (error) {
              console.error(`Error fetching attendance for session ${session.id}:`, error);
              return {
                ...session,
                present: 0,
                absent: 0,
                percentage: 0,
                totalStudents: studentsCount || 0
              };
            }
          })
        );
        
        setSessionStats(sessionsWithStats);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // Set up polling every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let filtered = [...sessionStats];
    
    // Apply filter
    if (sessionFilter === "active") {
      filtered = filtered.filter(s => s.is_active);
    } else if (sessionFilter === "inactive") {
      filtered = filtered.filter(s => !s.is_active);
    }
    
    // Apply sorting
    if (sortBy === "date") {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "attendance") {
      filtered.sort((a, b) => b.percentage - a.percentage);
    } else if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return filtered;
  }, [sessionStats, sessionFilter, sortBy]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    if (!sessionStats.length) return { averageAttendance: 0, totalSessions: 0 };
    
    // Calculate weighted average based on total present/absent across all sessions
    const totalPresent = sessionStats.reduce((acc, s) => acc + s.present, 0);
    const totalAbsent = sessionStats.reduce((acc, s) => acc + s.absent, 0);
    const totalRecorded = totalPresent + totalAbsent;
    
    const averageRate = totalRecorded > 0 
      ? Math.round((totalPresent / totalRecorded) * 100)
      : 0;
    
    return {
      averageAttendance: averageRate,
      totalSessions: sessionStats.length
    };
  }, [sessionStats]);

  // Handle viewing session details
  const handleViewDetails = async (session: any) => {
    try {
      setSelectedSession(session);
      
      // Fetch all students
      const { data: allStudents, error: studentsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('username');
        
      if (studentsError) throw studentsError;
      
      // Fetch attendance for this session
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', session.id);
        
      if (attendanceError) throw attendanceError;
      
      // Separate present and absent students based on status
      // Consider 'present' and 'late' as present
      const presentUsernames = new Set(
        attendance?.filter(a => a.status === 'present' || a.status === 'late')
          .map(a => a.username) || []
      );
      
      const present = (allStudents || []).filter(s => presentUsernames.has(s.username));
      const absent = (allStudents || []).filter(s => !presentUsernames.has(s.username));
      
      setPresentStudents(present);
      setAbsentStudents(absent);
      setShowDetailsDialog(true);
    } catch (error) {
      console.error("Error fetching session details:", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Attendance Management
          </h1>
          <p className="text-muted-foreground mt-1">Monitor and manage attendance across all sessions</p>
        </div>
        <Button className="shadow-lg hover:shadow-xl transition-shadow">
          <Download className="mr-2 h-4 w-4" /> Export All
        </Button>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
        >
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                {overallStats.totalSessions}
              </div>
              <p className="text-xs text-muted-foreground mt-2">All time sessions</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
        >
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Attendance</CardTitle>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors duration-300">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {overallStats.averageAttendance}%
                </div>
                {overallStats.averageAttendance >= 75 && (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    Good
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Institution-wide</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
        >
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="pb-3 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors duration-300">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-center gap-2">
                <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {sessionStats.filter(s => s.is_active).length}
                </div>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Currently running</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Filter className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">Filters</span>
              </div>
              <div className="flex-1 flex flex-wrap gap-3">
                <Select value={sessionFilter} onValueChange={setSessionFilter}>
                  <SelectTrigger className="w-[180px] border-border/40 bg-background/50">
                    <SelectValue placeholder="All Sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] border-border/40 bg-background/50">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Sort by Date</SelectItem>
                    <SelectItem value="attendance">Sort by Attendance</SelectItem>
                    <SelectItem value="name">Sort by Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Sessions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Session Records
            </CardTitle>
            <CardDescription>Detailed attendance records for all sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="min-w-full divide-y divide-border/40">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Present</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Absent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/50">
                  <AnimatePresence mode="popLayout">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading sessions...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredSessions.length > 0 ? (
                      filteredSessions.map((session, index) => (
                        <motion.tr
                          key={session.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                          className="hover:bg-primary/5 transition-colors duration-200"
                        >
                          <td className="px-4 py-4 text-sm font-medium">{session.name}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">
                            {new Date(session.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {session.is_active ? (
                              <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="border-border/40">
                                Ended
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="font-semibold">{session.present}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                                <XCircle className="h-4 w-4 text-red-600" />
                              </div>
                              <span className="font-semibold">{session.absent}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-muted rounded-full h-2 max-w-[120px] overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${session.percentage}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.05 }}
                                  className={`h-2 rounded-full ${
                                    session.percentage >= 75 ? 'bg-green-500' : 
                                    session.percentage >= 50 ? 'bg-yellow-500' : 
                                    'bg-red-500'
                                  }`}
                                />
                              </div>
                              <span className="font-semibold min-w-[45px]">{session.percentage}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewDetails(session)}
                              className="hover:bg-primary/10 hover:text-primary transition-colors"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                              <CalendarDays className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No sessions found</p>
                            <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {selectedSession?.name} - Attendance Details
              </DialogTitle>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowDetailsDialog(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedSession?.date} • {selectedSession?.time}
            </p>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Present Students */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Present ({presentStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {presentStudents.map((student) => (
                      <div 
                        key={student.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20"
                      >
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{student.username}</p>
                        </div>
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    ))}
                    {presentStudents.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-8">
                        No students marked present
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Absent Students */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  Absent ({absentStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {absentStudents.map((student) => (
                      <div 
                        key={student.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-red-50 dark:bg-red-950/20"
                      >
                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                          <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{student.username}</p>
                        </div>
                        <XCircle className="h-5 w-5 text-red-600" />
                      </div>
                    ))}
                    {absentStudents.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-8">
                        All students present!
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
