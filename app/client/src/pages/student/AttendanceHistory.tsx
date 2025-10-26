import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  Calendar,
  AlertCircle,
  Search
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'od' | 'ml';

interface AttendanceRecord {
  id: string;
  date: string;
  session_name: string;
  session_id: string;
  status: AttendanceStatus;
  check_in_time: string;
  username: string;
  name: string;
}

export default function AttendanceHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | AttendanceStatus,
    search: ''
  });

  // Fetch real attendance data from Supabase
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('username', user.username)
          .order('date', { ascending: false });

        if (error) {
          console.error('Error loading attendance data:', error);
          setAttendanceData([]);
          setFilteredData([]);
        } else {
          setAttendanceData(data || []);
          setFilteredData(data || []);
        }
      } catch (error) {
        console.error('Error loading attendance data:', error);
        setAttendanceData([]);
        setFilteredData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Apply filters
  useEffect(() => {
    let result = [...attendanceData];

    // Filter by status
    if (filters.status !== 'all') {
      result = result.filter(record => record.status === filters.status);
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(record => 
        record.session_name.toLowerCase().includes(searchTerm) ||
        record.name.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredData(result);
  }, [filters, attendanceData]);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Present
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Late
          </Badge>
        );
      case 'absent':
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Absent
          </Badge>
        );
      case 'od':
        return (
          <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">
            OD
          </Badge>
        );
      case 'ml':
        return (
          <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
            ML
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Loading attendance history...</p>
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
            View and track your class attendance records
          </p>
        </div>
        <Badge variant="outline" className="border-border/40">
          <FileText className="h-3 w-3 mr-1" />
          {filteredData.length} Records
        </Badge>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Attendance Records
                </CardTitle>
                <CardDescription className="mt-1">Your attendance history for all classes</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 md:w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search..."
                    className="pl-10 border-border/40 bg-background/50"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
                <Button variant="outline" className="border-border/40">
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Check-in Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/50">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No attendance records found</p>
                          <p className="text-xs text-muted-foreground">Try adjusting your search</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((record, index) => (
                      <motion.tr
                        key={record.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-primary/5 transition-colors duration-200">
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {format(parseISO(record.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-sm">{record.session_name}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {record.check_in_time ? format(parseISO(record.check_in_time), 'hh:mm a') : '—'}
                        </td>
                        <td className="px-4 py-4">{getStatusBadge(record.status)}</td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredData.length > 0 && (
              <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-border/40">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredData.length}</span> of <span className="font-semibold text-foreground">{attendanceData.length}</span> records
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
