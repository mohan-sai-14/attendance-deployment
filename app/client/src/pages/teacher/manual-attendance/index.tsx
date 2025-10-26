import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, XCircle, Clock, Stethoscope, FileText, Sun, Loader2, Users, Save, Calendar } from "lucide-react";
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/use-toast';
import { format } from 'date-fns';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'od' | 'ml';

interface User {
  id: number; // Changed from string to number (serial)
  username: string;
  name: string;
  email: string;
  role: string;
  status: string;
  enroll_no?: string;
  registered_no?: string;
  department?: string;
  section?: string;
  program?: string;
  year?: string;
}

interface AttendanceRecord {
  id: string;
  username: string;
  session_id: string;
  check_in_time: string;
  status: AttendanceStatus;
  name: string;
  date?: string;
  session_name?: string;
  role: string;
  enroll_no: string;
  registered_no: string;
  department?: string;
  program?: string;
  section?: string;
  year?: string;
}

interface Session {
  id: string;
  name: string;
  date: string;
}

export default function ManualAttendance() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const { toast } = useToast();

  // Fetch users and sessions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch users
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select(`
            id,
            username,
            name,
            email,
            role,
            status,
            enroll_no,
            registered_no,
            department,
            section,
            program,
            year
          `)
          .order('username');

        if (usersError) throw usersError;

        // Fetch sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .order('date', { ascending: false });

        if (sessionsError) throw sessionsError;

        setUsers(usersData || []);
        setFilteredUsers(usersData || []);
        setSessions(sessionsData || []);

        // Set the most recent session as selected by default
        if (sessionsData?.length) {
          setSelectedSession(sessionsData[0].id);
        }

        console.log('Loaded users data structure:', usersData?.[0]);
        console.log('Loaded users:', usersData?.length || 0);
        console.log('Loaded sessions:', sessionsData?.length || 0);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  // Fetch attendance for selected date and session
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!selectedSession || !selectedDate) return;

      try {
        console.log('Fetching attendance for date:', selectedDate, 'session:', selectedSession);

        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('date', selectedDate)
          .eq('session_id', selectedSession);

        if (error) throw error;

        // Create a map of username to attendance status
        const attendanceMap: Record<string, AttendanceStatus> = {};
        data?.forEach(record => {
          attendanceMap[record.username] = record.status;
        });

        console.log('Loaded existing attendance:', data?.length || 0, 'records');
        console.log('Attendance data structure:', data?.[0]);
        console.log('Attendance map:', attendanceMap);

        setAttendance(attendanceMap);
      } catch (error) {
        console.error('Error fetching attendance:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load attendance data',
        });
      }
    };

    fetchAttendance();
  }, [selectedDate, selectedSession, toast]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(
      user =>
        (user.name || user.email).toLowerCase().includes(query) ||
        (user.enroll_no || '').toLowerCase().includes(query) ||
        (user.registered_no || '').toLowerCase().includes(query) ||
        (user.program || '').toLowerCase().includes(query) ||
        (user.department || '').toLowerCase().includes(query) ||
        (user.section || '').toLowerCase().includes(query) ||
        (user.year || '').toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleStatusChange = (username: string, status: AttendanceStatus) => {
    console.log('Status change for user:', username, 'to status:', status);
    setAttendance(prev => {
      const newAttendance = {
        ...prev,
        [username]: status
      };
      console.log('Updated attendance state:', newAttendance);
      return newAttendance;
    });
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'od': return 'bg-purple-100 text-purple-800';
      case 'ml': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <Clock className="h-4 w-4" />;
      case 'od': return <FileText className="h-4 w-4" />;
      case 'ml': return <Stethoscope className="h-4 w-4" />;
      default: return null;
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedSession) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a session',
      });
      return;
    }

    // Check if there are any attendance records to save
    if (Object.keys(attendance).length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No attendance records to save. Please mark some attendance first.',
      });
      return;
    }

    try {
      setIsLoading(true);

      // Prepare attendance records
      const attendanceRecords = Object.entries(attendance).map(([username, status]) => {
        const user = users.find(u => u.username === username);
        if (!user) {
          throw new Error(`User not found: ${username}`);
        }

        return {
          username: username,
          session_id: selectedSession,
          check_in_time: new Date().toISOString(),
          status: status,
          name: user.name,
          date: selectedDate,
          session_name: sessions.find(s => s.id === selectedSession)?.name || 'Session',
          role: user.role,
          enroll_no: user.enroll_no || '',
          registered_no: user.registered_no || '',
          department: user.department || '',
          program: user.program || '',
          section: user.section || '',
          year: user.year || ''
        };
      });

      console.log('Saving attendance records:', attendanceRecords);

      // Only delete if there are existing records to avoid unnecessary operations
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('date', selectedDate)
        .eq('session_id', selectedSession);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        // Don't throw here, continue with insert
      }

      // Insert new attendance records
      const { data, error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceRecords)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      console.log('Attendance saved successfully:', data);

      toast({
        title: 'Success',
        description: `Attendance saved successfully for ${attendanceRecords.length} students`,
      });
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save attendance: ' + (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !users.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
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
            Manual Attendance
          </h1>
          <p className="text-muted-foreground mt-1">
            Mark attendance for students manually
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-border/40">
            <Users className="h-3 w-3 mr-1" />
            {filteredUsers.length} Students
          </Badge>
          <Badge variant="outline" className="border-border/40">
            <Calendar className="h-3 w-3 mr-1" />
            {selectedDate}
          </Badge>
        </div>
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
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Mark Attendance
                </CardTitle>
                <CardDescription className="mt-1">Select students and mark their attendance status</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search students..."
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name} - {format(new Date(session.date), 'PP')}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full md:w-auto"
                />
              </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/50">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                            <Users className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No students found</p>
                          <p className="text-xs text-muted-foreground">Try adjusting your search</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-primary/5 transition-colors duration-200">
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-sm">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4">{user.username}</td>
                        <td className="px-4 py-4">{user.department}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {(['present', 'absent', 'late', 'od', 'ml'] as const).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(user.username, status)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                                  attendance[user.username] === status
                                    ? getStatusColor(status) + ' shadow-sm'
                                    : 'bg-muted hover:bg-muted/80 hover:shadow-sm'
                                }`}
                              >
                                {getStatusIcon(status)}
                                <span className="ml-1 capitalize">
                                  {status === 'ml' ? 'ML' : status === 'od' ? 'OD' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center justify-between mb-4">
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-green-100" /> Present
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-red-100" /> Absent
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-yellow-100" /> Late
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-purple-100" /> OD
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-blue-100" /> ML
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border border-border/40">
                <div className="text-sm text-muted-foreground">
                  {Object.keys(attendance).length > 0 ? (
                    <span className="font-medium text-foreground">
                      {Object.keys(attendance).length} student(s) marked
                    </span>
                  ) : (
                    <span>No attendance marked yet</span>
                  )}
                </div>
                <Button
                  onClick={handleSaveAttendance}
                  disabled={isLoading || !selectedSession || Object.keys(attendance).length === 0}
                  className="shadow-lg hover:shadow-xl transition-shadow w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Attendance
                    </>
                  )}
                </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
