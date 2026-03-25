import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  ChevronRight, 
  ArrowLeft,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  date: string;
  session_name: string;
  status: 'present' | 'absent' | 'late' | 'od' | 'ml';
  check_in_time: string;
}

interface SubjectStat {
  name: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export default function SubjectWiseAttendance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('attendance')
          .select('*')
          .eq('username', user.username)
          .order('date', { ascending: false });

        if (error) throw error;
        setRecords(data || []);
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [user]);

  const subjectStats = useMemo(() => {
    const stats: Record<string, { total: number; present: number; absent: number }> = {};

    records.forEach(record => {
      const subjectName = record.session_name?.split(' - ')[0]?.trim() || 'General';
      if (!stats[subjectName]) {
        stats[subjectName] = { total: 0, present: 0, absent: 0 };
      }
      
      stats[subjectName].total += 1;
      if (['present', 'late', 'od', 'ml'].includes(record.status?.toLowerCase())) {
        stats[subjectName].present += 1;
      } else {
        stats[subjectName].absent += 1;
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
      percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage);
  }, [records]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-12 w-12 border-4 border-emerald-100 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Subject Metrics...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
      <header className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/student/dashboard')}
          className="p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-foreground tracking-tight">Academic Breakdown</h1>
            <p className="text-muted-foreground font-medium">Subject-wise performance and eligibility tracking.</p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            {subjectStats.length} Subjects Tracked
          </Badge>
        </div>
      </header>

      {subjectStats.length === 0 ? (
        <Card className="border-dashed border-2 border-border p-12 text-center bg-muted/20">
          <div className="flex flex-col items-center gap-4">
             <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <BookOpen className="h-8 w-8" />
             </div>
             <div className="space-y-1">
                <h3 className="font-bold text-lg">No Attendance Data</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Once you start marking attendance, your subject-wise breakdown will appear here.</p>
             </div>
             <Button onClick={() => navigate('/student/dashboard')} variant="outline" className="mt-4 rounded-xl">
                Go to Dashboard
             </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subjectStats.map((subject, idx) => {
            const isEligible = subject.percentage >= 75;
            const isAtRisk = subject.percentage >= 65 && subject.percentage < 75;

            return (
              <motion.div
                key={subject.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-card rounded-2xl group">
                  <div className={cn(
                    "h-1.5 w-full",
                    isEligible ? "bg-emerald-500" : isAtRisk ? "bg-amber-500" : "bg-rose-500"
                  )} />
                  <CardHeader className="p-6 pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-extrabold group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{subject.name}</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest">Academic Module</CardDescription>
                      </div>
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm border",
                        isEligible ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                        isAtRisk ? "bg-amber-50 text-amber-600 border-amber-100" : 
                        "bg-rose-50 text-rose-600 border-rose-100"
                      )}>
                        {subject.percentage}%
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-4 space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                         <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Attendance Progress</span>
                         <span className="text-xs font-bold">{subject.present} / {subject.total} Sessions</span>
                      </div>
                      <Progress 
                        value={subject.percentage} 
                        className={cn(
                          "h-2.5",
                          isEligible ? "[&>div]:bg-emerald-500" : isAtRisk ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"
                        )} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2">
                       <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Present</p>
                            <p className="text-sm font-bold leading-none">{subject.present}</p>
                          </div>
                       </div>
                       <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-3">
                          <XCircle className="h-4 w-4 text-rose-500" />
                          <div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Absent</p>
                            <p className="text-sm font-bold leading-none">{subject.absent}</p>
                          </div>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          {isEligible ? (
                            <div className="flex items-center gap-1.5 text-emerald-600">
                               <CheckCircle className="h-3.5 w-3.5" />
                               <span className="text-[10px] font-black uppercase">Statutory Safe</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-500">
                               <AlertCircle className="h-3.5 w-3.5" />
                               <span className="text-[10px] font-black uppercase">{isAtRisk ? "At Risk" : "Shortage"}</span>
                            </div>
                          )}
                       </div>
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => navigate(`/student/attendance-history?search=${encodeURIComponent(subject.name)}`)}
                         className="h-8 text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 rounded-lg group"
                       >
                         View Logs
                         <ChevronRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <footer className="pt-8 border-t border-border/50 text-center opacity-60">
         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border">
            <Info className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Min. 75% attendance required for exam eligibility</p>
         </div>
      </footer>
    </div>
  );
}
