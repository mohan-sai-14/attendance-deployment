import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, Download, Filter, Loader2, Eye, FileText, Users, CheckCircle, XCircle, Clock, AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

interface AttendanceSummary {
  date: string;
  session_id: string;
  session_name: string;
  present: number;
  absent: number;
  late: number;
  od: number;
  ml: number;
  total: number;
  status: 'completed' | 'pending';
}

export default function AttendanceHistory() {
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [studentDetails, setStudentDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching attendance history...');

      // First, fetch all sessions to get session details
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, name, date')
        .order('date', { ascending: false });

      if (sessionsError) {
        console.error('❌ Error fetching sessions:', sessionsError);
        return;
      }

      console.log('📅 Sessions fetched:', sessions?.length || 0);
      console.log('Sample sessions:', sessions?.slice(0, 3));
      console.log('All session IDs:', sessions?.map(s => s.id));

      // Create a map of session_id to session details
      const sessionMap = new Map(sessions?.map(session => [session.id, session]) || []);
      console.log('🗺️ Session map created with', sessionMap.size, 'entries');

      // Fetch all attendance records
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .order('date', { ascending: false });

      if (attendanceError) {
        console.error('❌ Error fetching attendance:', attendanceError);
        return;
      }

      console.log('📊 Attendance records fetched:', attendanceRecords?.length || 0);
      console.log('Sample attendance records:', attendanceRecords?.slice(0, 3));
      console.log('Attendance session IDs:', attendanceRecords?.map(a => a.session_id));

      // Group by date and session
      const groupedData = new Map<string, AttendanceSummary>();

      attendanceRecords?.forEach(record => {
        const session = sessionMap.get(record.session_id);
        console.log('🔗 Processing record:', record.session_id, 'Session found:', !!session);

        if (!session) {
          console.log('⚠️ Session not found for session_id:', record.session_id);
          console.log('Available session IDs:', Array.from(sessionMap.keys()));
          // Create a fallback summary for records without valid sessions
          const fallbackKey = `fallback-${record.session_id}-${record.date || 'unknown'}`;

          if (!groupedData.has(fallbackKey)) {
            groupedData.set(fallbackKey, {
              date: record.date || new Date().toISOString().split('T')[0],
              session_id: record.session_id,
              session_name: record.session_name || 'Unknown Session',
              present: 0,
              absent: 0,
              late: 0,
              od: 0,
              ml: 0,
              total: 0,
              status: 'completed' as const
            });
          }

          const summary = groupedData.get(fallbackKey)!;
          summary.total++;

          switch (record.status) {
            case 'present':
              summary.present++;
              break;
            case 'absent':
              summary.absent++;
              break;
            case 'late':
              summary.late++;
              break;
            case 'od':
              summary.od++;
              break;
            case 'ml':
              summary.ml++;
              break;
          }
          return;
        }

        const key = `${session.date}-${record.session_id}`;
        console.log('🔑 Group key:', key);

        if (!groupedData.has(key)) {
          groupedData.set(key, {
            date: session.date,
            session_id: record.session_id,
            session_name: record.session_name || session.name || 'Session',
            present: 0,
            absent: 0,
            late: 0,
            od: 0,
            ml: 0,
            total: 0,
            status: 'completed' as const
          });
          console.log('📈 Created new summary for key:', key);
        }

        const summary = groupedData.get(key)!;
        summary.total++;
        console.log('📊 Updated total:', summary.total, 'Status:', record.status);

        switch (record.status) {
          case 'present':
            summary.present++;
            break;
          case 'absent':
            summary.absent++;
            break;
          case 'late':
            summary.late++;
            break;
          case 'od':
            summary.od++;
            break;
          case 'ml':
            summary.ml++;
            break;
        }
      });

      const summaries = Array.from(groupedData.values());
      console.log('📋 Final summaries:', summaries.length);
      console.log('Summaries data:', summaries);

      setAttendanceData(summaries);

    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = attendanceData.filter(item =>
    item.session_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.date.includes(searchQuery)
  );

  const handleViewDetails = async (sessionId: string, date: string) => {
    try {
      setLoadingDetails(true);
      setShowDetailsDialog(true);
      
      // Fetch session details
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      setSelectedSession(session);
      
      // Fetch attendance records for this session
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', sessionId)
        .eq('date', date);
      
      // Fetch all students
      const { data: allStudents } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('username');
      
      // Create a map of attendance by username
      const attendanceMap = new Map(
        attendanceRecords?.map(record => [record.username, record]) || []
      );
      
      // Combine student data with attendance status
      const detailedStudents = allStudents?.map(student => ({
        ...student,
        attendance: attendanceMap.get(student.username) || null,
        status: attendanceMap.get(student.username)?.status || 'absent'
      })) || [];
      
      setStudentDetails(detailedStudents);
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Attendance History
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage attendance records
          </p>
        </div>
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardContent className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading attendance records...</p>
          </CardContent>
        </Card>
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
            Attendance History
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage attendance records
          </p>
        </div>
        <Badge variant="outline" className="border-border/40">
          <FileText className="h-3 w-3 mr-1" />
          {filteredData.length} Records
        </Badge>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Attendance Records
                </CardTitle>
                <CardDescription className="mt-1">Historical attendance data for all sessions</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search records..."
                    className="pl-10 border-border/40 bg-background/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="border-border/40">
                  <Calendar className="mr-2 h-4 w-4" />
                  Date Range
                </Button>
                <Button variant="outline" className="border-border/40">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
                <Button className="shadow-lg hover:shadow-xl transition-shadow">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Present</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Absent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Late</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">OD</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">ML</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/50">
                  {filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <motion.tr
                        key={`${item.date}-${item.session_id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-primary/5 transition-colors duration-200">
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {format(new Date(item.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">{item.session_name}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="font-semibold text-green-600">{item.present}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <span className="font-semibold text-red-600">{item.absent}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-yellow-600" />
                            </div>
                            <span className="font-semibold text-yellow-600">{item.late}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-purple-600 font-semibold">{item.od}</td>
                        <td className="px-4 py-4 text-blue-600 font-semibold">{item.ml}</td>
                        <td className="px-4 py-4 font-semibold">{item.total}</td>
                        <td className="px-4 py-4">
                          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 capitalize">
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(item.session_id, item.date)}
                            className="hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {searchQuery ? 'No matching records found' : 'No attendance records found'}
                          </p>
                          <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredData.length > 0 && (
              <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-border/40">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredData.length}</span> of <span className="font-semibold text-foreground">{attendanceData.length}</span> records
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled className="border-border/40">
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled className="border-border/40">
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {selectedSession?.name} - Student Details
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
              {selectedSession?.date && format(new Date(selectedSession.date), 'MMMM dd, yyyy')} • {selectedSession?.time}
            </p>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {studentDetails.map((student) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'present': return 'bg-green-50 dark:bg-green-950/20 border-green-200';
                      case 'late': return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200';
                      case 'absent': return 'bg-red-50 dark:bg-red-950/20 border-red-200';
                      case 'od': return 'bg-purple-50 dark:bg-purple-950/20 border-purple-200';
                      case 'ml': return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200';
                      default: return 'bg-gray-50 dark:bg-gray-950/20 border-gray-200';
                    }
                  };

                  const getStatusIcon = (status: string) => {
                    switch (status) {
                      case 'present': return <CheckCircle className="h-5 w-5 text-green-600" />;
                      case 'late': return <Clock className="h-5 w-5 text-yellow-600" />;
                      case 'absent': return <XCircle className="h-5 w-5 text-red-600" />;
                      case 'od': return <FileText className="h-5 w-5 text-purple-600" />;
                      case 'ml': return <AlertCircle className="h-5 w-5 text-blue-600" />;
                      default: return <XCircle className="h-5 w-5 text-gray-600" />;
                    }
                  };

                  return (
                    <div 
                      key={student.id}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${getStatusColor(student.status)}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {student.name || `${student.first_name} ${student.last_name}`}
                          </p>
                          <p className="text-xs text-muted-foreground">{student.enroll_no || student.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {student.status}
                        </Badge>
                        {getStatusIcon(student.status)}
                      </div>
                    </div>
                  );
                })}
                {studentDetails.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground py-8">
                    No student data available
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
