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
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface AttendanceSummary {
  date: string;
  session_id: string;
  session_name: string;
  class_name: string;
  class_id: string;
  section: string;
  present: number;
  absent: number;
  late: number;
  od: number;
  ml: number;
  total: number;
  status: 'completed' | 'pending';
}

export default function AttendanceHistory() {
  const { user } = useAuth();
  const [attendanceData, setAttendanceData] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [studentDetails, setStudentDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchAttendanceHistory();
    }
  }, [user?.id]);

  const fetchAttendanceHistory = async () => {
    try {
      setLoading(true);

      // 1. Fetch all sessions for this teacher
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, name, date, class_id, section')
        .eq('created_by', user?.id)
        .order('date', { ascending: false });

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) {
        setAttendanceData([]);
        return;
      }

      // 2. Fetch class details
      const classIds = [...new Set(sessions.map(s => s.class_id).filter(Boolean))];
      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds);
      
      const classesMap = new Map(classesData?.map(c => [c.id, c]) || []);

      // 3. Initialize grouped data with all sessions
      const groupedData = new Map<string, AttendanceSummary>();
      
      sessions.forEach(session => {
        const key = `${session.date}-${session.id}`;
        const classInfo = classesMap.get(session.class_id);
        const className = classInfo 
          ? `${classInfo.program} ${classInfo.year} - ${classInfo.section}`
          : 'Unknown Class';

        groupedData.set(key, {
          date: session.date,
          session_id: session.id,
          session_name: session.name || 'Session',
          class_name: className,
          class_id: session.class_id,
          section: session.section || classInfo?.section || '',
          present: 0,
          absent: 0,
          late: 0,
          od: 0,
          ml: 0,
          total: 0,
          status: 'completed' as const
        });
      });

      // 4. Fetch attendance records and update summaries
      const sessionIds = sessions.map(s => s.id);
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('session_id, status')
        .in('session_id', sessionIds);

      if (attendanceError) throw attendanceError;

      attendanceRecords?.forEach(record => {
        const session = sessions.find(s => s.id === record.session_id);
        if (!session) return;

        const key = `${session.date}-${record.session_id}`;
        const summary = groupedData.get(key);
        if (summary) {
          summary.total++;
          if (record.status === 'present') summary.present++;
          else if (record.status === 'absent') summary.absent++;
          else if (record.status === 'late') summary.late++;
          else if (record.status === 'od') summary.od++;
          else if (record.status === 'ml') summary.ml++;
        }
      });

      setAttendanceData(Array.from(groupedData.values()));

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
        .eq('session_id', sessionId);
      
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

  const stats = {
    totalSessions: attendanceData.length,
    avgAttendance: attendanceData.length > 0 
      ? Math.round(attendanceData.reduce((acc, curr) => acc + (curr.present / curr.total), 0) / attendanceData.length * 100) 
      : 0,
    totalStudents: attendanceData.length > 0 ? attendanceData[0].total : 0
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-[#E5E7EB]">
            <Loader2 className="h-6 w-6 animate-spin text-[#10B981]" />
          </div>
          <p className="text-sm font-bold text-[#374151] uppercase tracking-widest">Loading History...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-12">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-black text-[#374151] tracking-tight">Attendance History</h1>
            <p className="text-[#6B7280] mt-1 font-medium">Comprehensive logs of all academic sessions</p>
          </motion.div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-[#374151] hover:bg-[#1F2937] text-white font-bold rounded-xl px-6 shadow-lg shadow-black/5">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-none ring-1 ring-[#E5E7EB] bg-white shadow-xl shadow-black/5 rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-[#10B981] flex items-center justify-center">
                  <FileText className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Total Sessions</p>
                  <p className="text-2xl font-black text-[#374151]">{stats.totalSessions}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-none ring-1 ring-[#E5E7EB] bg-white shadow-xl shadow-black/5 rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">Avg. Attendance</p>
                  <p className="text-2xl font-black text-[#374151]">{stats.avgAttendance}%</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* Filters & Search */}
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.4 }}
           className="bg-white border border-[#E5E7EB] rounded-3xl p-3 flex flex-col md:flex-row items-center gap-3 shadow-sm"
        >
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <Input
              type="search"
              placeholder="Search by session name or date..."
              className="pl-11 h-12 border-none bg-transparent focus-visible:ring-0 text-[#374151] font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="h-8 w-px bg-[#E5E7EB] hidden md:block" />
          <Button variant="ghost" className="h-12 px-6 rounded-2xl text-[#374151] font-bold hover:bg-[#F9FAFB]">
            <Calendar className="mr-2 h-4 w-4 text-[#6B7280]" />
            Select Range
          </Button>
          <Button variant="ghost" className="h-12 px-6 rounded-2xl text-[#374151] font-bold hover:bg-[#F9FAFB]">
            <Filter className="mr-2 h-4 w-4 text-[#6B7280]" />
            More Filters
          </Button>
        </motion.div>

        {/* Main Data Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}>
          <Card className="border-none ring-1 ring-[#E5E7EB] shadow-2xl shadow-black/5 rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="px-6 py-5 text-left text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Session Info</th>
                      <th className="px-6 py-5 text-left text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Class Info</th>
                      <th className="px-6 py-5 text-center text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Attendance</th>
                      <th className="px-6 py-5 text-center text-[10px] font-black text-[#6B7280] uppercase tracking-widest">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredData.length > 0 ? (
                      filteredData.map((item, index) => (
                        <tr
                          key={`${item.date}-${item.session_id}`}
                          onClick={() => handleViewDetails(item.session_id, item.date)}
                          className="hover:bg-[#F9FAFB]/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-[#374151] text-base group-hover:text-[#10B981] transition-colors">{item.session_name}</span>
                              <span className="text-xs font-bold text-[#9CA3AF] mt-1 uppercase tracking-tighter">
                                {format(new Date(item.date), 'EEEE, MMM dd, yyyy')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-[#374151] text-sm uppercase tracking-tight">{item.class_name}</span>
                              <span className="text-[10px] font-black text-[#10B981] mt-0.5 uppercase tracking-widest">Section {item.section}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-[#374151]">{item.present}</span>
                                <span className="text-xs font-bold text-[#9CA3AF]">/ {item.total}</span>
                              </div>
                              <div className="w-24 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[#10B981] transition-all duration-500" 
                                  style={{ width: `${(item.present/item.total)*100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-4">
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-red-500">{item.absent}</span>
                                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">ABS</span>
                              </div>
                              <div className="h-6 w-px bg-[#E5E7EB]" />
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-amber-500">{item.late}</span>
                                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">LAT</span>
                              </div>
                              <div className="h-6 w-px bg-[#E5E7EB]" />
                              <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-blue-500">{item.od + item.ml}</span>
                                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">OTH</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center max-w-sm mx-auto gap-4">
                            <div className="h-20 w-20 rounded-3xl bg-[#F9FAFB] flex items-center justify-center border-2 border-dashed border-[#E5E7EB]">
                              <Search className="h-10 w-10 text-[#D1D5DB]" />
                            </div>
                            <div>
                               <p className="text-lg font-black text-[#374151]">No records found</p>
                               <p className="text-sm text-[#9CA3AF] mt-1">Try searching with a different session name or adjust your filter selection.</p>
                            </div>
                            <Button variant="outline" onClick={() => setSearchQuery("")} className="rounded-xl font-bold border-[#E5E7EB]">
                               Clear Search
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Details Dialog - Redesigned */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl p-0 gap-0 border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
          <div className="bg-[#374151] p-8 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tight">{selectedSession?.name}</h3>
                <div className="flex items-center gap-3 mt-2">
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-wider">
                      <Calendar className="h-3.5 w-3.5" />
                      {selectedSession?.date && format(new Date(selectedSession.date), 'MMMM dd, yyyy')}
                   </div>
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-wider">
                      <Clock className="h-3.5 w-3.5" />
                      {selectedSession?.time || '09:00 AM'}
                   </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowDetailsDialog(false)}
                className="text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="p-8">
            {loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-[#10B981]" />
                <p className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">Fetching Students...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                   <h4 className="text-xs font-black text-[#6B7280] uppercase tracking-widest">Attendee Breakdown</h4>
                   <Badge className="bg-[#F3F4F6] text-[#6B7280] border-none font-bold rounded-lg text-[10px] px-2 py-0.5">
                      {studentDetails.length} Total Students
                   </Badge>
                </div>
                
                <ScrollArea className="h-[450px] pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-6">
                    {studentDetails.map((student) => {
                      const getStatusMeta = (status: string) => {
                        switch (status) {
                          case 'present': return { bg: 'bg-[#10B981]/5', text: 'text-[#059669]', icon: <CheckCircle className="h-4 w-4" />, border: 'border-[#10B981]/20' };
                          case 'late': return { bg: 'bg-amber-50', text: 'text-amber-600', icon: <Clock className="h-4 w-4" />, border: 'border-amber-200' };
                          case 'absent': return { bg: 'bg-red-50', text: 'text-red-600', icon: <XCircle className="h-4 w-4" />, border: 'border-red-200' };
                          case 'od': return { bg: 'bg-purple-50', text: 'text-purple-600', icon: <FileText className="h-4 w-4" />, border: 'border-purple-200' };
                          case 'ml': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: <AlertCircle className="h-4 w-4" />, border: 'border-blue-200' };
                          default: return { bg: 'bg-gray-50', text: 'text-gray-600', icon: <XCircle className="h-4 w-4" />, border: 'border-gray-200' };
                        }
                      };

                      const meta = getStatusMeta(student.status);

                      return (
                        <div 
                          key={student.id}
                          className={`flex items-center gap-4 p-4 rounded-2xl border ${meta.border} ${meta.bg} transition-all duration-300 hover:shadow-md`}
                        >
                          <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center border border-black/5 shrink-0">
                            <span className="text-sm font-black text-[#374151]">
                              {student.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 
                               (student.first_name?.charAt(0) + student.last_name?.charAt(0)).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-[#374151] truncate">
                              {student.name || `${student.first_name} ${student.last_name}`}
                            </p>
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-tighter">{student.enroll_no || student.username}</p>
                          </div>
                          <div className={`p-2 rounded-lg ${meta.bg} ${meta.text}`}>
                             {meta.icon}
                          </div>
                        </div>
                      );
                    })}
                    {studentDetails.length === 0 && (
                      <div className="col-span-2 py-20 text-center">
                        <AlertCircle className="h-10 w-10 text-[#D1D5DB] mx-auto mb-3" />
                        <p className="text-sm font-bold text-[#9CA3AF] uppercase tracking-widest">No attendee data available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
