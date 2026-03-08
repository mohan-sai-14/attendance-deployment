import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { 
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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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


  // Calculate Summary Stats
  const stats = {
    total: filteredData.length,
    present: filteredData.filter(r => r.status === 'present').length,
    absent: filteredData.filter(r => r.status === 'absent').length,
    late: filteredData.filter(r => r.status === 'late').length,
    od: filteredData.filter(r => r.status === 'od').length,
    ml: filteredData.filter(r => r.status === 'ml').length,
  };

  // Group by Month
  const groupedData = filteredData.reduce((acc, record) => {
    const monthYear = format(parseISO(record.date), 'MMMM yyyy');
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

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

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <Card className="bg-background/50 border-border/40 hover:bg-accent/5 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold">{stats.total}</span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total</span>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20 hover:bg-green-500/10 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-green-600 dark:text-green-500">{stats.present}</span>
            <span className="text-xs text-green-600/70 dark:text-green-500/70 uppercase tracking-wider mt-1">Present</span>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20 hover:bg-red-500/10 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-red-600 dark:text-red-500">{stats.absent}</span>
            <span className="text-xs text-red-600/70 dark:text-red-500/70 uppercase tracking-wider mt-1">Absent</span>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">{stats.late}</span>
            <span className="text-xs text-yellow-600/70 dark:text-yellow-500/70 uppercase tracking-wider mt-1">Late</span>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-500">{stats.od}</span>
            <span className="text-xs text-purple-600/70 dark:text-purple-500/70 uppercase tracking-wider mt-1">On Duty (OD)</span>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-500">{stats.ml}</span>
            <span className="text-xs text-blue-600/70 dark:text-blue-500/70 uppercase tracking-wider mt-1">Med Leave</span>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}>
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Attendance Records
                </CardTitle>
                <CardDescription className="mt-1">Your detailed timeline</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 bg-muted/50 p-1 rounded-lg">
                  <Button 
                    variant={filters.status === 'all' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setFilters({...filters, status: 'all'})}
                    className="h-8"
                  >
                    All
                  </Button>
                  <Button 
                    variant={filters.status === 'present' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setFilters({...filters, status: 'present'})}
                    className="h-8 text-green-600"
                  >
                    Present
                  </Button>
                  <Button 
                    variant={filters.status === 'absent' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setFilters({...filters, status: 'absent'})}
                    className="h-8 text-red-600"
                  >
                    Absent
                  </Button>
                </div>
                <div className="relative flex-1 sm:w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search session..."
                    className="pl-10 h-10 border-border/40 bg-background/50"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.entries(groupedData).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border rounded-xl bg-muted/10">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No attendance records found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your filters or search term</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedData).map(([month, records], groupIndex) => (
                  <div key={month} className="space-y-4">
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        {month}
                        <Badge variant="secondary" className="font-normal">{records.length}</Badge>
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {records.map((record, index) => {
                        let statusColor = 'bg-border/50';
                        if (record.status === 'present') statusColor = 'bg-green-500';
                        if (record.status === 'absent') statusColor = 'bg-red-500';
                        if (record.status === 'late') statusColor = 'bg-yellow-500';
                        if (record.status === 'od') statusColor = 'bg-purple-500';
                        if (record.status === 'ml') statusColor = 'bg-blue-500';

                        return (
                          <motion.div
                            key={record.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                          >
                            <Card className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col justify-center">
                              <div className="flex h-full">
                                <div className={`w-1.5 shrink-0 ${statusColor}`} />
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                  <div className="flex justify-between items-start gap-2 mb-3">
                                    <div>
                                      <p className="font-semibold text-sm leading-tight line-clamp-2" title={record.session_name}>{record.session_name}</p>
                                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {format(parseISO(record.date), 'MMM dd, yyyy')}
                                      </p>
                                    </div>
                                    <div className="shrink-0">{getStatusBadge(record.status)}</div>
                                  </div>
                                  
                                  <div className="mt-auto pt-3 border-t flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {record.check_in_time ? format(parseISO(record.check_in_time), 'hh:mm a') : 'No check-in'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
