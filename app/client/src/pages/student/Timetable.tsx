import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CalendarDays, 
  Clock, 
  BookOpen, 
  User as UserIcon, 
  Loader2, 
  ChevronRight, 
  Search, 
  MapPin, 
  Info,
  Calendar,
  Coffee,
  Utensils,
  Moon
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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
  icon?: any;
}

const TIME_SLOTS: TimeSlotConfig[] = [
  { id: 'p1', label: 'Period 1', start: '09:00', end: '09:50', type: 'period' },
  { id: 'p2', label: 'Period 2', start: '09:50', end: '10:40', type: 'period' },
  { id: 'b1', label: 'Short Break', start: '10:40', end: '11:00', type: 'break', icon: Coffee },
  { id: 'p3', label: 'Period 3', start: '11:00', end: '11:50', type: 'period' },
  { id: 'p4', label: 'Period 4', start: '11:50', end: '12:40', type: 'period' },
  { id: 'b2', label: 'Lunch Break', start: '12:40', end: '13:30', type: 'break', icon: Utensils },
  { id: 'p5', label: 'Period 5', start: '13:30', end: '14:20', type: 'period' },
  { id: 'p6', label: 'Period 6', start: '14:20', end: '15:10', type: 'period' },
  { id: 'b3', label: 'Tea Break', start: '15:10', end: '15:30', type: 'break', icon: Coffee },
  { id: 'p7', label: 'Period 7', start: '15:30', end: '16:20', type: 'period' },
  { id: 'p8', label: 'Period 8', start: '16:20', end: '17:10', type: 'period' },
];

export default function StudentTimetable() {
  const { user } = useAuth();
  const [classId, setClassId] = useState<string | null>(null);
  const [classDetails, setClassDetails] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS_OF_WEEK[new Date().getDay() - 1] || DAYS_OF_WEEK[0]);

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-pulse">
        <div className="relative">
          <div className="h-16 w-16 border-4 border-gray-100 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <Calendar className="h-6 w-6 text-emerald-500/50" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-black text-foreground uppercase tracking-widest">Building Schedule</p>
          <p className="text-xs text-muted-foreground font-medium">Fetching academic blueprint...</p>
        </div>
      </div>
    );
  }

  if (!classId && !isLoading) {
    return (
      <div className="max-w-md mx-auto py-20 px-6 text-center space-y-8 animate-in fade-in duration-700">
        <div className="relative w-fit mx-auto">
           <div className="absolute inset-0 bg-amber-500/10 blur-[40px] rounded-full scale-150"></div>
           <div className="h-24 w-24 rounded-[2.5rem] bg-card border border-amber-100 flex items-center justify-center text-amber-500 shadow-xl relative overflow-hidden group">
              <CalendarDays className="h-12 w-12" />
           </div>
        </div>
        <div className="space-y-3">
           <h3 className="text-3xl font-black text-foreground tracking-tighter">Draft Profile</h3>
           <p className="text-muted-foreground font-medium leading-relaxed">
             We couldn't link your account to a specific class section. Please synchronize your profile details at the Academic Office.
           </p>
        </div>
        <Button onClick={() => window.location.href = '/student/dashboard'} className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl transition-all">
           Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 space-y-10 animate-in fade-in duration-700">
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
             <div className="h-1 w-8 rounded-full bg-emerald-500"></div>
             <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-emerald-100 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5">Course Schedule</Badge>
          </div>
          <h1 className="text-4xl font-black text-foreground tracking-tighter">Academic Timetable</h1>
          <p className="text-gray-500 font-medium max-w-md">
            Your structured journey through {classDetails?.department} • {classDetails?.year} {classDetails?.section}
          </p>
        </div>
        
        <div className="flex items-center gap-2 p-1.5 bg-card rounded-2xl shadow-sm border border-gray-100">
           <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{classDetails?.program}</span>
           </div>
           <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{classDetails?.year} {classDetails?.section}</span>
           </div>
        </div>
      </header>

      {/* Day Selector (Mobile Priority) */}
      <div className="flex overflow-x-auto pb-4 sm:pb-0 gap-3 no-scrollbar scroll-smooth">
         {DAYS_OF_WEEK.map((day) => (
           <Button
             key={day}
             variant={selectedDay === day ? "default" : "ghost"}
             onClick={() => setSelectedDay(day)}
             className={cn(
               "h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shrink-0 transition-all",
               selectedDay === day 
                 ? "bg-primary text-white shadow-xl scale-105" 
                 : "text-muted-foreground hover:text-foreground hover:bg-gray-50 border border-transparent hover:border-gray-100"
             )}
           >
             {day}
           </Button>
         ))}
      </div>

      {/* Timeline View */}
      <div className="grid grid-cols-1 gap-6 relative">
         <div className="absolute left-[39px] sm:left-[119px] top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/20 via-gray-100 to-transparent hidden sm:block"></div>
         
         <AnimatePresence mode="wait">
           <motion.div
             key={selectedDay}
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             transition={{ duration: 0.3 }}
             className="space-y-6"
           >
             {TIME_SLOTS.map((slot, i) => {
               const assigned = getSlot(selectedDay, slot.start);
               const fac = faculty.find(f => f.username === assigned?.faculty_id);
               const isBreak = slot.type === 'break';
               const Icon = slot.icon || BookOpen;

               return (
                 <div key={slot.id} className="group relative flex gap-6 sm:gap-12 items-start">
                   {/* Time Column */}
                   <div className="w-20 sm:w-28 pt-4 flex flex-col items-center sm:items-end shrink-0">
                      <span className="text-xl font-black text-foreground tracking-tighter leading-none">{slot.start}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 group-hover:text-emerald-500 transition-colors">{slot.end}</span>
                   </div>

                   {/* Indicator Dot */}
                   <div className="absolute left-[35px] sm:left-[115px] top-6 w-3 h-3 rounded-full border-2 border-white bg-gray-200 z-10 transition-all group-hover:bg-emerald-500 group-hover:scale-125 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] hidden sm:block"></div>

                   {/* Content Card */}
                   <Card className={cn(
                     "flex-1 border-0 shadow-sm transition-all rounded-[2rem] overflow-hidden min-h-[100px] ring-1 ring-border",
                     assigned ? "bg-card hover:shadow-xl hover:translate-x-1" : "bg-gray-50/50 opacity-60",
                     isBreak && "bg-emerald-50/30 ring-emerald-100/50"
                   )}>
                     <CardContent className="p-6 flex items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                           <div className={cn(
                             "h-14 w-14 rounded-2xl flex items-center justify-center transition-all",
                             assigned ? "bg-primary text-white shadow-lg rotate-3 group-hover:rotate-0" : "bg-gray-100 text-muted-foreground",
                             isBreak && "bg-emerald-500 text-white shadow-emerald-200"
                           )}>
                              <Icon className="h-6 w-6" />
                           </div>
                           
                           <div className="space-y-1">
                              {isBreak ? (
                                <h4 className="text-lg font-black text-emerald-700 tracking-tight uppercase tracking-widest">{slot.label}</h4>
                              ) : (
                                <>
                                  <h4 className="text-lg font-black text-foreground leading-tight tracking-tight">
                                    {assigned ? assigned.subject_name : 'No Session Scheduled'}
                                  </h4>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    {assigned ? (fac?.name || assigned.faculty_id) : 'Self Study / Unassigned'}
                                  </p>
                                </>
                              )}
                           </div>
                        </div>

                        {!isBreak && assigned && (
                          <div className="hidden sm:flex flex-col items-end gap-2">
                             <div className="flex -space-x-2">
                                {[...Array(3)].map((_, i) => (
                                  <div key={i} className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                                     <UserIcon className="h-3 w-3" />
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                        
                        {assigned && (
                          <ChevronRight className="h-5 w-5 text-gray-200 group-hover:text-emerald-500 transition-colors" />
                        )}
                     </CardContent>
                   </Card>
                 </div>
               );
             })}
           </motion.div>
         </AnimatePresence>
      </div>

      {/* Helper Footer */}
      <footer className="pt-10 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6 opacity-60">
         <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-emerald-500" />
            <p className="text-xs font-medium text-muted-foreground">
              Schedule details are derived from the master clinical rotation and academic timetable.
            </p>
         </div>
         <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
               <MapPin className="h-4 w-4" />
            </div>
         </div>
      </footer>
    </div>
  );
}

