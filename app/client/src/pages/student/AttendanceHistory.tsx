import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  Calendar as CalendarIcon,
  AlertCircle,
  Search,
  ChevronRight,
  User,
  MapPin,
  TrendingUp,
  Award,
  Shield
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@/lib/utils';

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

  const getStatusConfig = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return {
          label: 'Present',
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-100',
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          dot: 'bg-emerald-500'
        };
      case 'late':
        return {
          label: 'Late',
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          border: 'border-amber-100',
          icon: <Clock className="h-3.5 w-3.5" />,
          dot: 'bg-amber-500'
        };
      case 'absent':
        return {
          label: 'Absent',
          color: 'text-rose-600',
          bg: 'bg-rose-50',
          border: 'border-rose-100',
          icon: <XCircle className="h-3.5 w-3.5" />,
          dot: 'bg-rose-500'
        };
      default:
        return {
          label: status.toUpperCase(),
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100',
          icon: <FileText className="h-3.5 w-3.5" />,
          dot: 'bg-blue-500'
        };
    }
  };

  // Calculate Summary Stats
  const stats = {
    total: attendanceData.length,
    present: attendanceData.filter(r => r.status === 'present').length,
    absent: attendanceData.filter(r => r.status === 'absent').length,
    percentage: attendanceData.length > 0 
      ? Math.round((attendanceData.filter(r => r.status === 'present').length / attendanceData.length) * 100) 
      : 0
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-pulse">
        <div className="relative">
          <div className="h-16 w-16 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <FileText className="h-6 w-6 text-emerald-500/50" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-black text-[#111827] uppercase tracking-widest">Compiling Records</p>
          <p className="text-xs text-gray-400 font-medium">Syncing with secure database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
             <div className="h-1 w-8 rounded-full bg-emerald-500"></div>
             <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-emerald-100 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5">Academic Transcript</Badge>
          </div>
          <h1 className="text-4xl font-black text-[#111827] tracking-tighter">Attendance History</h1>
          <p className="text-gray-500 font-medium max-w-md">
            Review your presence across all sessions and track your consistency milestones.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2.5 rounded-[1.5rem] shadow-xl shadow-gray-100 ring-1 ring-gray-100 border border-white">
           <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp className="h-6 w-6" />
           </div>
           <div className="pr-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Overall Presence</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-[#111827]">{stats.percentage}%</span>
                <span className="text-[10px] font-bold text-emerald-500 mb-0.5">↑ {stats.present} sessions</span>
              </div>
           </div>
        </div>
      </header>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Logs', value: stats.total, icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Attended', value: stats.present, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Missed', value: stats.absent, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Achievements', value: Math.floor(stats.present / 5), icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <Card key={i} className="border-[#E5E7EB] shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all bg-white rounded-3xl overflow-hidden group border-0 ring-1 ring-gray-100">
             <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                   <div className={cn("p-3 rounded-2xl transition-colors group-hover:bg-white border ring-4 ring-transparent group-hover:ring-gray-50", stat.bg, stat.color)}>
                      <stat.icon className="h-5 w-5" />
                   </div>
                   <div className="h-1 w-6 rounded-full bg-gray-100 mt-2"></div>
                </div>
                <h4 className="text-3xl font-black text-[#111827] tracking-tighter mb-1">{stat.value}</h4>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
             </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
           <Input
             placeholder="Search by subject or session name..."
             className="pl-12 h-14 bg-white border-[#E5E7EB] rounded-2xl shadow-sm focus:ring-emerald-500 focus:border-emerald-500 font-medium text-gray-600"
             value={filters.search}
             onChange={(e) => setFilters({...filters, search: e.target.value})}
           />
        </div>
        
        <div className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
           {['all', 'present', 'absent'].map((status) => (
             <Button
               key={status}
               variant={filters.status === status ? 'default' : 'ghost'}
               onClick={() => setFilters({...filters, status: status as any})}
               className={cn(
                 "h-11 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all",
                 filters.status === status 
                   ? "bg-[#111827] text-white shadow-lg" 
                   : "text-gray-400 hover:text-[#111827] hover:bg-gray-50"
               )}
             >
               {status}
             </Button>
           ))}
        </div>
      </div>

      {/* Logs Section */}
      <div className="space-y-12">
        {Object.entries(groupedData).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-6 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <div className="h-24 w-24 rounded-[2.5rem] bg-white flex items-center justify-center text-gray-200 shadow-sm">
               <AlertCircle className="h-12 w-12" />
            </div>
            <div className="space-y-1">
               <h3 className="text-2xl font-black text-[#111827] tracking-tight">No match found</h3>
               <p className="text-gray-400 font-medium">Try adjusting your filters or search terms.</p>
            </div>
            <Button 
               variant="outline" 
               onClick={() => setFilters({status: 'all', search: ''})}
               className="h-12 px-8 rounded-2xl border-gray-200 font-bold uppercase text-[10px] tracking-widest"
            >
               Reset Filters
            </Button>
          </div>
        ) : (
          Object.entries(groupedData).map(([month, records], groupIndex) => (
            <div key={month} className="space-y-6">
              <div className="flex items-center gap-4 px-2">
                 <h3 className="text-xl font-black text-[#111827] tracking-tight">{month}</h3>
                 <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent"></div>
                 <Badge className="bg-gray-100 text-gray-500 border-0 font-bold">{records.length} Logs</Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {records.map((record, index) => {
                  const config = getStatusConfig(record.status);
                  
                  return (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <Card className="border-0 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all bg-white rounded-[2rem] overflow-hidden group ring-1 ring-gray-100">
                        <CardContent className="p-0 flex items-stretch h-full min-h-[140px]">
                          {/* Sidebar Indicator */}
                          <div className={cn("w-2.5 shrink-0 transition-opacity group-hover:opacity-80", config.dot)} />
                          
                          <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <p className="font-black text-lg text-[#111827] leading-tight truncate group-hover:text-emerald-600 transition-colors" title={record.session_name}>
                                  {record.session_name}
                                </p>
                                <div className="flex items-center gap-3 text-gray-400 font-medium text-xs">
                                   <div className="flex items-center gap-1">
                                      <CalendarIcon className="h-3.5 w-3.5" />
                                      {format(parseISO(record.date), 'MMM dd, yyyy')}
                                   </div>
                                   <div className="flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5" />
                                      {record.check_in_time ? format(parseISO(record.check_in_time), 'hh:mm a') : 'Missed'}
                                   </div>
                                </div>
                              </div>
                              
                              <Badge className={cn("rounded-full px-3 py-1 border-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest", config.bg, config.color)}>
                                {config.icon}
                                {config.label}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                               <div className="flex items-center gap-2">
                                  <div className="h-8 w-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 overflow-hidden">
                                     <User className="h-4 w-4" />
                                  </div>
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Marked by {record.name.split(' ')[0]}</span>
                               </div>
                               <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-gray-50 text-gray-300 hover:text-emerald-500">
                                  <ChevronRight className="h-4 w-4" />
                               </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <footer className="pt-10 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6 opacity-60">
         <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Blockchain Verified Attendance Records</span>
         </div>
         <p className="text-[10px] font-bold text-gray-400">© 2024 Smart Attendance System • Student Portal v2.0</p>
      </footer>
    </div>
  );
}

