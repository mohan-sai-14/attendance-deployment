import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
   CheckCircle2,
   XCircle,
   Loader2,
   ArrowLeft,
   CalendarDays,
   AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const DEFAULT_TIME_SLOTS = [
   { id: 'p1', label: 'Period 1', start: '09:00', end: '09:50', type: 'period' as const },
   { id: 'p2', label: 'Period 2', start: '09:50', end: '10:40', type: 'period' as const },
   { id: 'b1', label: 'Short Break', start: '10:40', end: '11:00', type: 'break' as const },
   { id: 'p3', label: 'Period 3', start: '11:00', end: '11:50', type: 'period' as const },
   { id: 'p4', label: 'Period 4', start: '11:50', end: '12:40', type: 'period' as const },
   { id: 'b2', label: 'Lunch Break', start: '12:40', end: '13:30', type: 'break' as const },
   { id: 'p5', label: 'Period 5', start: '13:30', end: '14:20', type: 'period' as const },
   { id: 'p6', label: 'Period 6', start: '14:20', end: '15:10', type: 'period' as const },
   { id: 'b3', label: 'Tea Break', start: '15:10', end: '15:30', type: 'break' as const },
   { id: 'p7', label: 'Period 7', start: '15:30', end: '16:20', type: 'period' as const },
   { id: 'p8', label: 'Period 8', start: '16:20', end: '17:10', type: 'period' as const },
];

const DAYS_OF_WEEK_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimetableEntry {
   id: string;
   class_id: string;
   subject_name: string;
   faculty_id: string;
   day_of_week: string;
   start_time: string;
   end_time: string;
}

interface ClassInfo {
   id: string;
   program: string;
   year: string;
   section: string;
}

function formatTime12h(time24: string): string {
   const [h, m] = time24.split(':').map(Number);
   const ampm = h >= 12 ? 'PM' : 'AM';
   const hour = h % 12 || 12;
   return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function TeacherTimetable() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const { toast } = useToast();

   const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
   const [classesMap, setClassesMap] = useState<Record<string, ClassInfo>>({});
   const [isLoading, setIsLoading] = useState(true);

   const todayDayName = DAYS_OF_WEEK_NAMES[new Date().getDay() - 1] || '';

   useEffect(() => {
      const fetchTimetable = async () => {
         if (!user?.username) return;

         try {
            setIsLoading(true);

            // Fetch all timetable entries for this teacher
            const { data: ttData, error: ttError } = await supabase
               .from('timetables')
               .select('*')
               .eq('faculty_id', user.username);

            if (ttError) throw ttError;
            setTimetable(ttData || []);

            // Fetch class info
            const classIds = Array.from(new Set((ttData || []).map(t => t.class_id)));
            if (classIds.length > 0) {
               const { data: classesData, error: classError } = await supabase
                  .from('classes')
                  .select('id, program, year, section')
                  .in('id', classIds);

               if (classError) throw classError;
               const map: Record<string, ClassInfo> = {};
               (classesData || []).forEach(c => { map[c.id] = c; });
               setClassesMap(map);
            }
         } catch (error) {
            console.error('Error fetching timetable:', error);
            toast({
               variant: 'destructive',
               title: 'Error',
               description: 'Failed to load timetable',
            });
         } finally {
            setIsLoading(false);
         }
      };

      fetchTimetable();
   }, [user?.username, toast]);

   const getSlot = (day: string, startTime: string) => {
      return timetable.find(t => t.day_of_week === day && t.start_time?.startsWith(startTime));
   };

   const periodSlots = DEFAULT_TIME_SLOTS;

   if (isLoading) {
      return (
         <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground">Loading your timetable...</p>
            </div>
         </div>
      );
   }

   if (timetable.length === 0) {
      return (
         <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
            <Button variant="ghost" className="mb-4" onClick={() => navigate('/teacher/dashboard')}>
               <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Card className="border-border/40 shadow-lg">
               <CardContent className="pt-8 pb-8 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                     <AlertCircle className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">No Timetable Found</h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                     No classes have been assigned to you yet. Contact your admin to set up your timetable.
                  </p>
               </CardContent>
            </Card>
         </div>
      );
   }

   return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-5">
         <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/teacher/dashboard')}>
               <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
               <h1 className="text-xl font-bold text-foreground">My Timetable</h1>
               <p className="text-sm text-muted-foreground">Your weekly class schedule</p>
            </div>
         </div>

         <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="bg-muted/30 border-b">
                           <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r w-28">
                              Time
                           </th>
                           {DAYS_OF_WEEK_NAMES.map(day => (
                              <th
                                 key={day}
                                 className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider border-r min-w-[130px]
                        ${day === todayDayName
                                       ? 'bg-primary/5 text-primary'
                                       : 'text-muted-foreground'
                                    }
                      `}
                              >
                                 <div className="flex items-center justify-center gap-1.5">
                                    {day === todayDayName && (
                                       <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                    )}
                                    {day.substring(0, 3)}
                                 </div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {periodSlots.map(slot => (
                           <tr
                              key={slot.id}
                              className={`border-b transition-colors ${slot.type === 'break' ? 'bg-muted/5' : 'hover:bg-muted/10'}`}
                           >
                              {/* Time column */}
                              <td className="px-3 py-2.5 border-r">
                                 <div className="text-xs font-bold text-foreground">{slot.label}</div>
                                 <div className="text-[10px] text-muted-foreground">
                                    {formatTime12h(slot.start)} – {formatTime12h(slot.end)}
                                 </div>
                              </td>

                              {/* Day columns */}
                              {DAYS_OF_WEEK_NAMES.map(day => {
                                 if (slot.type === 'break') {
                                    return (
                                       <td key={`${day}-${slot.id}`} className="px-2 py-1.5 border-r text-center bg-muted/10">
                                          <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                                             {slot.label}
                                          </span>
                                       </td>
                                    );
                                 }

                                 const entry = getSlot(day, slot.start);
                                 const classInfo = entry ? classesMap[entry.class_id] : null;
                                 const isToday = day === todayDayName;

                                 return (
                                    <td
                                       key={`${day}-${slot.id}`}
                                       className={`px-2 py-2 border-r text-center align-top
                            ${isToday ? 'bg-primary/[0.02]' : ''}
                          `}
                                    >
                                       {entry ? (
                                          <motion.div
                                             initial={{ opacity: 0, scale: 0.95 }}
                                             animate={{ opacity: 1, scale: 1 }}
                                             className={`
                                rounded-lg p-2 m-0.5 text-left transition-all
                                ${isToday
                                                   ? 'bg-primary/10 border border-primary/20 shadow-sm'
                                                   : 'bg-muted/20 border border-border/30'
                                                }
                              `}
                                          >
                                             <span className="text-xs font-semibold text-foreground block truncate">
                                                {entry.subject_name}
                                             </span>
                                             {classInfo && (
                                                <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                                                   {classInfo.program} {classInfo.year} – {classInfo.section}
                                                </span>
                                             )}
                                          </motion.div>
                                       ) : (
                                          <div className="text-muted-foreground/20 text-[10px] py-3 italic">
                                             —
                                          </div>
                                       )}
                                    </td>
                                 );
                              })}
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </CardContent>
         </Card>

         {/* Legend */}
         <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
               <div className="h-3 w-3 rounded-sm bg-primary/10 border border-primary/20" />
               <span>Today's classes</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="h-3 w-3 rounded-sm bg-muted/20 border border-border/30" />
               <span>Other days</span>
            </div>
         </div>
      </div>
   );
}
