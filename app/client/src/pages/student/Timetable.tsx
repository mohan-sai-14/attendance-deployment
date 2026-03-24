import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, Clock, BookOpen, User as UserIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface TimetableRow {
  id: string;
  class_id: string;
  subject_name: string;
  faculty_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface FacultyRow {
  username: string;
  name: string;
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface TimeSlotConfig {
  id: string;
  label: string;
  start: string;
  end: string;
  type: 'period' | 'break';
}

const TIME_SLOTS: TimeSlotConfig[] = [
  { id: 'p1', label: 'Period 1', start: '09:00', end: '09:50', type: 'period' },
  { id: 'p2', label: 'Period 2', start: '09:50', end: '10:40', type: 'period' },
  { id: 'b1', label: 'Short Break', start: '10:40', end: '11:00', type: 'break' },
  { id: 'p3', label: 'Period 3', start: '11:00', end: '11:50', type: 'period' },
  { id: 'p4', label: 'Period 4', start: '11:50', end: '12:40', type: 'period' },
  { id: 'b2', label: 'Lunch Break', start: '12:40', end: '13:30', type: 'break' },
  { id: 'p5', label: 'Period 5', start: '13:30', end: '14:20', type: 'period' },
  { id: 'p6', label: 'Period 6', start: '14:20', end: '15:10', type: 'period' },
  { id: 'b3', label: 'Tea Break', start: '15:10', end: '15:30', type: 'break' },
  { id: 'p7', label: 'Period 7', start: '15:30', end: '16:20', type: 'period' },
  { id: 'p8', label: 'Period 8', start: '16:20', end: '17:10', type: 'period' },
];

export default function StudentTimetable() {
  const { user } = useAuth();
  const [classId, setClassId] = useState<string | null>(null);
  const [classDetails, setClassDetails] = useState<any>(null);

  // 1. Fetch Student Class ID based on profile
  useEffect(() => {
    const fetchClassId = async () => {
      if (!user?.username) return;
      
      const { data: profile } = await supabase
        .from('users')
        .select('department, program, year, section')
        .eq('username', user.username)
        .single();
      
      if (profile) {
        const { data: classData } = await supabase
          .from('classes')
          .select('*')
          .eq('department', profile.department)
          .eq('program', profile.program)
          .eq('year', profile.year)
          .eq('section', profile.section)
          .single();
        
        if (classData) {
          setClassId(classData.id);
          setClassDetails(classData);
        }
      }
    };
    
    fetchClassId();
  }, [user]);

  // 2. Fetch Timetable
  const { data: timetables = [], isLoading } = useQuery<TimetableRow[]>({
    queryKey: ['student-timetable', classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data, error } = await supabase.from('timetables').select('*').eq('class_id', classId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!classId
  });

  // 3. Fetch Faculty Names
  const { data: faculty = [] } = useQuery<FacultyRow[]>({
    queryKey: ['faculty-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('username, name').eq('role', 'teacher');
      if (error) throw error;
      return data || [];
    }
  });

  const getSlot = (day: string, startTime: string) => {
    return timetables.find(t => t.day_of_week === day && t.start_time.startsWith(startTime));
  };

  if (isLoading && classId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your timetable...</p>
      </div>
    );
  }

  if (!classId && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/20">
        <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h3 className="text-xl font-bold text-foreground/70">No Class Assigned</h3>
        <p className="text-sm text-muted-foreground max-w-xs mt-2 italic">
          We couldn't find a class matching your profile (Department, Year, Section). 
          Please contact administration to verify your profile details.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Your Timetable
          </h1>
          <p className="text-muted-foreground mt-2">
            Weekly schedule for {classDetails?.program} {classDetails?.year} ({classDetails?.section})
          </p>
        </div>
        <Badge variant="outline" className="h-fit py-1.5 px-3 bg-primary/5 text-primary border-primary/20 font-semibold uppercase tracking-wider text-[10px]">
          Academic Year 2023-24
        </Badge>
      </div>

      {/* Desktop Timetable View */}
      <Card className="border-border/40 shadow-xl overflow-hidden bg-background/60 backdrop-blur-md hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground">
                <th className="px-6 py-4 font-bold border-b border-r w-40 text-left">Period / Session</th>
                {DAYS_OF_WEEK.map(day => (
                  <th key={day} className="px-4 py-4 font-bold border-b border-r min-w-[160px]">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {TIME_SLOTS.map((slot) => (
                <tr key={slot.id} className={`${slot.type === 'break' ? 'bg-muted/10' : 'hover:bg-primary/5 transition-colors'}`}>
                  <td className="px-6 py-5 border-r font-medium text-left">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${slot.type === 'break' ? 'bg-orange-400' : 'bg-primary/60'}`} />
                      <span className="font-bold text-foreground text-sm">{slot.label}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 ml-4 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {slot.start} - {slot.end}
                    </div>
                  </td>
                  {DAYS_OF_WEEK.map(day => {
                    if (slot.type === 'break') {
                      return (
                        <td key={`${day}-${slot.id}`} className="px-2 py-2 border-r bg-muted/5 align-middle">
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">{slot.label}</span>
                        </td>
                      );
                    }
                    const assigned = getSlot(day, slot.start);
                    const fac = faculty.find(f => f.username === assigned?.faculty_id);

                    return (
                      <td key={`${day}-${slot.id}`} className="px-3 py-4 border-r align-middle">
                        {assigned ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-muted/20 border border-primary/20 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group"
                          >
                            <div className="flex items-center gap-1.5 mb-2">
                              <BookOpen className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                              <span className="font-bold text-foreground text-xs line-clamp-1">{assigned.subject_name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-medium">
                              <UserIcon className="h-3 w-3" />
                              <span className="line-clamp-1">{fac?.name || assigned.faculty_id}</span>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="text-muted-foreground/20 text-[10px] italic py-8">Free</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-6">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/40" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary">{day}</h3>
              <div className="h-px flex-1 bg-border/40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TIME_SLOTS.filter(s => s.type === 'period').map(slot => {
                const assigned = getSlot(day, slot.start);
                const fac = faculty.find(f => f.username === assigned?.faculty_id);
                
                return (
                  <Card key={`${day}-${slot.id}`} className={`border-border/40 overflow-hidden shadow-sm ${assigned ? 'bg-background' : 'bg-muted/20 opacity-60'}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                          <span className="text-[10px] font-bold">P{slot.label.split(' ')[1]}</span>
                          <span className="text-[8px] font-medium leading-tight">{slot.start}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">{assigned ? assigned.subject_name : 'No Class'}</h4>
                          <p className="text-[11px] text-muted-foreground truncate">{assigned ? (fac?.name || assigned.faculty_id) : 'Self Study / Free'}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] ${assigned ? 'text-primary' : 'text-muted-foreground'}`}>
                        {slot.start} - {slot.end}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
