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
      <div className="min-h-screen bg-[#F9FAFB] pb-12">
         <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                  <Button
                     variant="ghost"
                     size="icon"
                     onClick={() => navigate('/teacher/dashboard')}
                     className="h-10 w-10 rounded-full border border-[#E5E7EB] bg-white shadow-sm hover:bg-[#F3F4F6]"
                  >
                     <ArrowLeft className="h-4 w-4 text-[#374151]" />
                  </Button>
                  <div>
                     <h1 className="text-2xl font-extrabold text-[#374151]">My Timetable</h1>
                     <p className="text-sm text-[#6B7280]">Weekly overview of your academic sessions</p>
                  </div>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
                  <CalendarDays className="h-4 w-4 text-[#10B981]" />
                  <span className="text-xs font-bold text-[#374151] uppercase tracking-wider">Academic Year 2023-24</span>
               </div>
            </div>

            <Card className="border-none ring-1 ring-[#E5E7EB] shadow-xl shadow-black/5 rounded-3xl overflow-hidden bg-white">
               <CardContent className="p-0">
                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
                     <table className="w-full text-sm border-collapse">
                        <thead>
                           <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                              <th className="px-6 py-5 text-left text-[10px] font-black text-[#6B7280] uppercase tracking-widest border-r border-[#E5E7EB] w-32 bg-[#F9FAFB] sticky left-0 z-10">
                                 Time Slot
                              </th>
                              {DAYS_OF_WEEK_NAMES.map(day => (
                                 <th
                                    key={day}
                                    className={`px-4 py-5 text-center text-[10px] font-black uppercase tracking-widest border-r border-[#E5E7EB] min-w-[160px]
                                       ${day === todayDayName
                                          ? 'bg-[#10B981]/5 text-[#059669]'
                                          : 'text-[#6B7280]'
                                       }
                                    `}
                                 >
                                    <div className="flex flex-col items-center gap-1">
                                       <span>{day}</span>
                                       {day === todayDayName && (
                                          <div className="h-1 w-6 rounded-full bg-[#10B981]" />
                                       )}
                                    </div>
                                 </th>
                              ))}
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                           {periodSlots.map((slot, rowIndex) => (
                              <tr
                                 key={slot.id}
                                 className={`group transition-colors ${slot.type === 'break' ? 'bg-[#F3F4F6]/30' : 'bg-white hover:bg-[#F9FAFB]'}`}
                              >
                                 {/* Time column */}
                                 <td className="px-6 py-4 border-r border-[#E5E7EB] bg-[#F9FAFB] sticky left-0 z-10 group-hover:bg-[#F3F4F6] transition-colors">
                                    <div className="text-xs font-bold text-[#374151]">{slot.label}</div>
                                    <div className="text-[10px] text-[#9CA3AF] mt-0.5 font-medium">
                                       {formatTime12h(slot.start)} – {formatTime12h(slot.end)}
                                    </div>
                                 </td>

                                 {/* Day columns */}
                                 {DAYS_OF_WEEK_NAMES.map(day => {
                                    if (slot.type === 'break') {
                                       return (
                                          <td key={`${day}-${slot.id}`} className="px-4 py-3 border-r border-[#E5E7EB] text-center">
                                             <div className="flex items-center justify-center gap-2">
                                                <div className="h-px w-4 bg-[#E5E7EB]" />
                                                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em]">
                                                   {slot.label}
                                                </span>
                                                <div className="h-px w-4 bg-[#E5E7EB]" />
                                             </div>
                                          </td>
                                       );
                                    }

                                    const entry = getSlot(day, slot.start);
                                    const classInfo = entry ? classesMap[entry.class_id] : null;
                                    const isToday = day === todayDayName;

                                    return (
                                       <td
                                          key={`${day}-${slot.id}`}
                                          className={`px-3 py-3 border-r border-[#E5E7EB] text-center align-middle
                                             ${isToday ? 'bg-[#10B981]/[0.02]' : ''}
                                          `}
                                       >
                                          {entry ? (
                                             <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.02 * rowIndex }}
                                                className={`
                                                   group/entry relative rounded-2xl p-4 text-left border transition-all duration-300
                                                   ${isToday
                                                      ? 'bg-white border-[#10B981]/30 shadow-lg shadow-[#10B981]/5 ring-1 ring-[#10B981]/10'
                                                      : 'bg-white border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-md'
                                                   }
                                                `}
                                             >
                                                <div className="space-y-2">
                                                   <div className="flex items-start justify-between gap-2">
                                                      <span className="text-xs font-extrabold text-[#374151] leading-tight group-hover/entry:text-[#10B981] transition-colors">
                                                         {entry.subject_name}
                                                      </span>
                                                      {isToday && (
                                                         <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                                                      )}
                                                   </div>
                                                   {classInfo && (
                                                      <div className="space-y-1">
                                                         <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-tight">
                                                            {classInfo.program} {classInfo.year}
                                                         </p>
                                                         <div className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#F3F4F6] text-[9px] font-black text-[#4B5563] uppercase">
                                                            SEC {classInfo.section}
                                                         </div>
                                                      </div>
                                                   )}
                                                </div>
                                             </motion.div>
                                          ) : (
                                             <div className="flex items-center justify-center">
                                                <div className="h-1 w-1 rounded-full bg-[#E5E7EB]" />
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

            {/* Legend Card */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
               <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-white border border-[#10B981]/30 shadow-sm shadow-[#10B981]/20 ring-1 ring-[#10B981]/10" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Active Day Sessions</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-white border border-[#E5E7EB]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Scheduled Sessions</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-[#F3F4F6]/50 border border-[#E5E7EB]/50" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Break Periods</span>
               </div>
            </div>
         </div>
      </div>
   );
}
