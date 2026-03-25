import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Save,
  ArrowLeft,
  BookOpen,
  Timer,
  Lock,
  Unlock,
  ShieldAlert,
  Stethoscope,
  FileText,
} from "lucide-react";
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_TIME_SLOTS = [
  { id: 'p1', label: 'Period 1', start: '09:00', end: '09:50' },
  { id: 'p2', label: 'Period 2', start: '09:50', end: '10:40' },
  { id: 'p3', label: 'Period 3', start: '11:00', end: '11:50' },
  { id: 'p4', label: 'Period 4', start: '11:50', end: '12:40' },
  { id: 'p5', label: 'Period 5', start: '13:30', end: '14:20' },
  { id: 'p6', label: 'Period 6', start: '14:20', end: '15:10' },
  { id: 'p7', label: 'Period 7', start: '15:30', end: '16:20' },
  { id: 'p8', label: 'Period 8', start: '16:20', end: '17:10' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  department: string;
  program: string;
  year: string;
  section: string;
  batch: string;
}

interface PeriodCard {
  entry: TimetableEntry;
  classInfo: ClassInfo;
  slot: typeof DEFAULT_TIME_SLOTS[0];
  session: any | null;
}

interface AttendanceRecord {
  id: string;
  username: string;
  session_id: string;
  check_in_time: string;
  status: string;
  date: string;
  name?: string;
  enroll_no?: string;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function ManualAttendance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [periodCards, setPeriodCards] = useState<PeriodCard[]>([]);

  // Selected period / edit state (mirrors EditAttendance)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodCard | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);

  const todayName = DAYS_OF_WEEK[new Date().getDay()];
  const todayDate = new Date().toISOString().split('T')[0];

  // ── Fetch teacher's timetable ──
  useEffect(() => {
    const fetchTimetable = async () => {
      if (!user?.username) return;
      try {
        setIsLoading(true);
        const { data: timetableData, error: ttError } = await supabase
          .from('timetables')
          .select('*')
          .eq('faculty_id', user.username)
          .eq('day_of_week', todayName);
        if (ttError) throw ttError;

        if (!timetableData || timetableData.length === 0) {
          setPeriodCards([]);
          return;
        }

        const classIds = Array.from(new Set(timetableData.map(t => t.class_id)));
        const { data: classesData } = await supabase.from('classes').select('*').in('id', classIds);
        const classesMap: Record<string, ClassInfo> = (classesData || []).reduce((acc, cls) => {
          acc[cls.id] = cls;
          return acc;
        }, {} as Record<string, ClassInfo>);

        const { data: sessionsData } = await supabase
          .from('sessions')
          .select('*')
          .eq('date', todayDate)
          .eq('created_by', user.username);

        const cards: PeriodCard[] = [];
        for (const entry of timetableData) {
          const slot = DEFAULT_TIME_SLOTS.find(s => entry.start_time?.substring(0, 5) === s.start);
          if (!slot) continue;
          const classInfo = classesMap[entry.class_id];
          if (!classInfo) continue;
          const matchingSession = (sessionsData || []).find(s =>
            s.time?.substring(0, 5) === slot.start && s.class_id === entry.class_id
          );
          cards.push({ entry, classInfo, slot, session: matchingSession || null });
        }
        cards.sort((a, b) => a.slot.start.localeCompare(b.slot.start));
        setPeriodCards(cards);
      } catch (error) {
        console.error('Error fetching timetable:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load your timetable' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimetable();
  }, [user?.username, todayName, todayDate, toast]);

  // ── Countdown timer for lock ──
  useEffect(() => {
    if (isLocked || !selectedPeriod) return;
    const interval = setInterval(() => {
      const now = new Date();
      const [startH, startM] = selectedPeriod.slot.start.split(':').map(Number);
      const [endH, endM] = selectedPeriod.slot.end.split(':').map(Number);
      const slotStart = new Date(); slotStart.setHours(startH, startM, 0, 0);
      const slotEnd = new Date(); slotEnd.setHours(endH, endM, 0, 0);
      const isOngoing = now >= slotStart && now <= slotEnd;

      if (isOngoing) {
        setMinutesRemaining(Math.ceil((slotEnd.getTime() - now.getTime()) / 60000));
      } else if (selectedPeriod.session?.created_at) {
        const deadline = new Date(new Date(selectedPeriod.session.created_at).getTime() + 3600000);
        if (now > deadline) {
          setIsLocked(true);
          setMinutesRemaining(null);
          clearInterval(interval);
        } else {
          setMinutesRemaining(Math.ceil((deadline.getTime() - now.getTime()) / 60000));
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isLocked, selectedPeriod]);

  // ── When a period card is selected → load attendance (same as EditAttendance) ──
  const handleSelectPeriod = async (card: PeriodCard) => {
    setSelectedPeriod(card);
    setSearchQuery('');
    setChanges({});
    setIsStudentsLoading(true);

    try {
      const cls = card.classInfo;
      const sessionId = card.session?.id;

      // Check if this period is currently ongoing
      const now = new Date();
      const [startH, startM] = card.slot.start.split(':').map(Number);
      const [endH, endM] = card.slot.end.split(':').map(Number);
      const slotStart = new Date(); slotStart.setHours(startH, startM, 0, 0);
      const slotEnd = new Date(); slotEnd.setHours(endH, endM, 0, 0);
      const isOngoing = now >= slotStart && now <= slotEnd;

      // Check lock status — skip lock if period is currently ongoing
      if (isOngoing) {
        setIsLocked(false);
        const remaining = Math.ceil((slotEnd.getTime() - now.getTime()) / 60000);
        setMinutesRemaining(remaining);
      } else if (card.session?.created_at) {
        const createdAt = new Date(card.session.created_at);
        const deadline = new Date(createdAt.getTime() + 3600000);
        const locked = now > deadline;
        setIsLocked(locked);
        if (!locked) {
          setMinutesRemaining(Math.ceil((deadline.getTime() - now.getTime()) / 60000));
        } else {
          setMinutesRemaining(null);
        }
      } else {
        setIsLocked(false);
        setMinutesRemaining(null);
      }

      // Fetch all students in this class
      const { data: classStudents } = await supabase
        .from('users')
        .select('username, name, enroll_no')
        .eq('role', 'student')
        .eq('status', 'active')
        .eq('department', cls.department)
        .eq('program', cls.program)
        .eq('year', cls.year)
        .eq('section', cls.section);

      // Fetch existing attendance records if session exists
      let attMap: Record<string, any> = {};
      if (sessionId) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('session_id', sessionId);
        attMap = (attData || []).reduce((acc, a) => {
          acc[a.username] = a;
          return acc;
        }, {} as Record<string, any>);
      }

      // Build enriched records (exactly like EditAttendance)
      const enrichedRecords: AttendanceRecord[] = (classStudents || []).map(student => {
        const existing = attMap[student.username];
        return {
          id: existing?.id || `temp-${student.username}`,
          username: student.username,
          session_id: sessionId || '',
          check_in_time: existing?.check_in_time || '',
          status: existing?.status || 'absent',
          date: existing?.date || todayDate,
          name: student.name,
          enroll_no: student.enroll_no,
        };
      });

      enrichedRecords.sort((a, b) => {
        const idA = a.enroll_no || a.username || '';
        const idB = b.enroll_no || b.username || '';
        return idA.localeCompare(idB);
      });

      setRecords(enrichedRecords);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load students' });
    } finally {
      setIsStudentsLoading(false);
    }
  };

  // ── Set status (matches EditAttendance) ──
  const setStatus = (recordId: string, newStatus: string) => {
    if (isLocked) return;
    setChanges(prev => ({ ...prev, [recordId]: newStatus }));
  };

  const getEffectiveStatus = (record: AttendanceRecord) => {
    return changes[record.id] || record.status;
  };

  const statusOptions = [
    { key: 'present', label: 'P', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { key: 'absent', label: 'A', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3.5 w-3.5" /> },
    { key: 'late', label: 'Late', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'od', label: 'OD', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400', icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'ml', label: 'ML', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Stethoscope className="h-3.5 w-3.5" /> },
  ];

  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.username || '').toLowerCase().includes(q) ||
      (r.enroll_no || '').toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const presentCount = records.filter(r => getEffectiveStatus(r) === 'present').length;
  const absentCount = records.filter(r => getEffectiveStatus(r) === 'absent').length;
  const hasChanges = Object.keys(changes).length > 0;

  // ── Save (same logic as EditAttendance) ──
  const handleSave = async () => {
    if (isLocked || !hasChanges || !selectedPeriod) return;

    try {
      setIsSaving(true);

      let sessionId = selectedPeriod.session?.id;

      // Create session if none exists
      if (!sessionId) {
        const { data: newSession, error: sessError } = await supabase
          .from('sessions')
          .insert({
            name: `${selectedPeriod.entry.subject_name} - ${selectedPeriod.slot.label}`,
            date: todayDate,
            time: selectedPeriod.slot.start,
            duration:
              (parseInt(selectedPeriod.slot.end.split(':')[0]) * 60 + parseInt(selectedPeriod.slot.end.split(':')[1])) -
              (parseInt(selectedPeriod.slot.start.split(':')[0]) * 60 + parseInt(selectedPeriod.slot.start.split(':')[1])),
            is_active: true,
            class_id: selectedPeriod.entry.class_id,
            section: selectedPeriod.classInfo.section,
            expires_at: new Date(Date.now() + 60*60*1000).toISOString(), // Default 1 hour for manual creation
            created_by: user.id,
          })
          .select()
          .single();
        if (sessError) throw sessError;
        sessionId = newSession.id;
        setSelectedPeriod(prev => prev ? { ...prev, session: newSession } : null);
      }

      // Save each change (insert or update)
      for (const [recordId, newStatus] of Object.entries(changes)) {
        if (recordId.startsWith('temp-')) {
          const username = recordId.replace('temp-', '');
          const student = records.find(r => r.username === username);
          const { error } = await supabase.from('attendance').insert({
            username,
            session_id: sessionId,
            status: newStatus,
            date: todayDate,
            check_in_time: new Date().toISOString(),
            name: student?.name || username,
            session_name: `${selectedPeriod.entry.subject_name} - ${selectedPeriod.slot.label}`,
            role: 'student',
            enroll_no: student?.enroll_no || '',
            department: selectedPeriod.classInfo.department,
            program: selectedPeriod.classInfo.program,
            section: selectedPeriod.classInfo.section,
            year: selectedPeriod.classInfo.year,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('attendance')
            .update({ status: newStatus })
            .eq('id', recordId);
          if (error) throw error;
        }
      }

      setChanges({});
      toast({ title: 'Changes Saved', description: 'Attendance records updated successfully.' });

      // Refetch to get real IDs for temp records
      handleSelectPeriod(selectedPeriod);
    } catch (error) {
      console.error('Error saving:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLockAttendance = async () => {
     if (!selectedPeriod?.session?.id) return;
     if (!confirm("Are you sure you want to lock attendance? This will close the session and no further changes can be made.")) return;

     try {
       setIsSaving(true);
       const { error } = await supabase
         .from('sessions')
         .update({ 
            is_active: false, 
            expires_at: new Date().toISOString() 
         })
         .eq('id', selectedPeriod.session.id);
       
       if (error) throw error;
       
       setIsLocked(true);
       setMinutesRemaining(null);
       toast({ 
          title: 'Attendance Locked', 
          description: 'The session has been successfully closed.' 
       });
     } catch (error) {
       console.error('Error locking attendance:', error);
       toast({ 
          variant: 'destructive', 
          title: 'Action Failed', 
          description: 'Could not lock the attendance session.' 
       });
     } finally {
       setIsSaving(false);
     }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your classes...</p>
        </div>
      </div>
    );
  }

   return (
      <div className="min-h-screen bg-[#F9FAFB] pb-12">
         <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
            {/* Back + Header */}
            <div className="flex items-center gap-4 mb-2">
               <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-[#E5E7EB] bg-white shadow-sm hover:bg-[#F3F4F6] shrink-0"
                  onClick={() => selectedPeriod ? (() => { setSelectedPeriod(null); setRecords([]); setChanges({}); })() : navigate('/teacher/dashboard')}
               >
                  <ArrowLeft className="h-4 w-4 text-[#374151]" />
               </Button>
               <div>
                  <h1 className="text-2xl font-black text-[#374151]">Manual Attendance</h1>
                  <p className="text-sm text-[#6B7280]">
                     {selectedPeriod ? "Update attendance for selected session" : "Select a session to manage attendance"}
                  </p>
               </div>
            </div>

            <AnimatePresence mode="wait">
               {!selectedPeriod ? (
                  /* ── CLASS CARDS ── */
                  <motion.div
                     key="cards"
                     initial={{ opacity: 0, y: 15 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -15 }}
                     className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                     {periodCards.length === 0 ? (
                        <Card className="col-span-1 md:col-span-2 border-none ring-1 ring-[#E5E7EB] shadow-lg shadow-black/5 rounded-[2.5rem] bg-white">
                           <CardContent className="pt-20 pb-20 text-center">
                              <div className="h-20 w-20 rounded-3xl bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] flex items-center justify-center mx-auto mb-6">
                                 <BookOpen className="h-10 w-10 text-[#D1D5DB]" />
                              </div>
                              <h2 className="text-xl font-black text-[#374151]">No Classes Today</h2>
                              <p className="text-[#9CA3AF] mt-2 font-medium max-w-xs mx-auto">You don't have any scheduled sessions for today in your timetable.</p>
                           </CardContent>
                        </Card>
                     ) : (
                        periodCards.map((card, index) => {
                           const hasTaken = !!card.session;
                           const now = new Date();
                           const [sH, sM] = card.slot.start.split(':').map(Number);
                           const [eH, eM] = card.slot.end.split(':').map(Number);
                           const ss = new Date(); ss.setHours(sH, sM, 0, 0);
                           const se = new Date(); se.setHours(eH, eM, 0, 0);
                           const isOngoing = now >= ss && now <= se;
                           const locked = !isOngoing && card.session && now > new Date(new Date(card.session.created_at).getTime() + 3600000);

                           return (
                              <motion.div
                                 key={card.entry.id}
                                 initial={{ opacity: 0, scale: 0.95 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 transition={{ delay: index * 0.05 }}
                              >
                                 <Card
                                    className={`group border-none ring-1 ring-[#E5E7EB] shadow-xl shadow-black/5 rounded-[2rem] cursor-pointer transition-all hover:scale-[1.02] hover:ring-[#10B981]/50 bg-white overflow-hidden relative ${locked ? 'opacity-80' : ''}`}
                                    onClick={() => handleSelectPeriod(card)}
                                 >
                                    <CardContent className="p-6">
                                       <div className="flex items-start justify-between gap-4">
                                          <div className="space-y-4 flex-1">
                                             <div className="flex items-center gap-2">
                                                <Badge className="bg-[#374151]/5 text-[#374151] border-none font-black text-[10px] px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                                   {card.slot.label}
                                                </Badge>
                                                {isOngoing && (
                                                   <Badge className="bg-[#10B981]/10 text-[#10B981] border-none font-black text-[10px] px-2 py-0.5 rounded-lg uppercase animate-pulse">
                                                      Ongoing
                                                   </Badge>
                                                )}
                                                {hasTaken && (
                                                   <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[10px] px-2 py-0.5 rounded-lg uppercase">
                                                      Recorded
                                                   </Badge>
                                                )}
                                             </div>
                                             
                                             <div>
                                                <h3 className="text-xl font-black text-[#374151] group-hover:text-[#10B981] transition-colors line-clamp-1">{card.entry.subject_name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                   <div className="h-5 w-5 rounded-full bg-[#374151] flex items-center justify-center shrink-0">
                                                      <span className="text-[10px] font-black text-white">{card.classInfo.section.charAt(0)}</span>
                                                   </div>
                                                   <span className="text-xs font-bold text-[#6B7280] uppercase tracking-tighter">SEC {card.classInfo.section} • {card.classInfo.program}</span>
                                                </div>
                                             </div>

                                             <div className="flex items-center gap-3 pt-2">
                                                <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                                                   <Timer className="h-3.5 w-3.5" />
                                                   <span className="text-[10px] font-black uppercase tracking-widest">
                                                      {formatTime12h(card.slot.start)} – {formatTime12h(card.slot.end)}
                                                   </span>
                                                </div>
                                             </div>
                                          </div>
                                          <div className="h-10 w-10 rounded-full bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center group-hover:bg-[#10B981] group-hover:border-[#10B981] group-hover:text-white transition-all shrink-0">
                                             <ArrowLeft className="h-4 w-4 rotate-180" />
                                          </div>
                                       </div>
                                       
                                       {locked && (
                                          <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
                                             <div className="px-4 py-2 bg-[#374151] text-white rounded-full flex items-center gap-2 shadow-xl">
                                                <Lock className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-wider">LOCKED</span>
                                             </div>
                                          </div>
                                       )}
                                    </CardContent>
                                 </Card>
                              </motion.div>
                           );
                        })
                     )}
                  </motion.div>
               ) : (
                  /* ── EDIT ATTENDANCE VIEW ── */
                  <motion.div
                     key="edit"
                     initial={{ opacity: 0, y: 15 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -15 }}
                     className="space-y-6 pb-24"
                  >
                     {/* Session Header Card */}
                     <Card className="border-none ring-1 ring-[#E5E7EB] bg-white shadow-2xl shadow-black/5 rounded-[2.5rem] overflow-hidden">
                        <div className="p-8">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                              <div>
                                 <h2 className="text-2xl font-black text-[#374151] tracking-tight leading-none">
                                    {selectedPeriod.entry.subject_name}
                                 </h2>
                                 <div className="flex flex-wrap items-center gap-3 mt-4">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-[#F3F4F6] rounded-full text-[10px] font-black text-[#4B5563] uppercase tracking-wider">
                                       <Timer className="h-3.5 w-3.5" />
                                       {selectedPeriod.slot.label} • {formatTime12h(selectedPeriod.slot.start)} – {formatTime12h(selectedPeriod.slot.end)}
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-[#F3F4F6] rounded-full text-[10px] font-black text-[#4B5563] uppercase tracking-wider">
                                       <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                                       SEC {selectedPeriod.classInfo.section}
                                    </div>
                                 </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                 {isLocked ? (
                                    <div className="px-5 py-2.5 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-2">
                                       <Lock className="h-4 w-4" />
                                       <span className="text-xs font-black uppercase tracking-widest">Locked</span>
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-2">
                                       <div className="px-5 py-2.5 bg-emerald-50 text-[#10B981] rounded-2xl border border-[#10B981]/20 flex items-center gap-2 shadow-sm">
                                          <Unlock className="h-4 w-4" />
                                          <span className="text-xs font-black uppercase tracking-widest">Editable</span>
                                       </div>
                                       {selectedPeriod.session && (
                                          <Button
                                             variant="outline"
                                             size="sm"
                                             onClick={handleLockAttendance}
                                             className="h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-2xl px-4 flex items-center gap-2"
                                          >
                                             <Lock className="h-4 w-4" />
                                             <span className="text-[10px] font-black uppercase tracking-widest">Lock Attendance</span>
                                          </Button>
                                       )}
                                    </div>
                                 )}
                              </div>
                           </div>

                           {/* Dynamic Status Banner */}
                           {!isLocked && (
                              <motion.div 
                                 initial={{ opacity: 0, height: 0 }}
                                 animate={{ opacity: 1, height: 'auto' }}
                                 className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center gap-3"
                              >
                                 <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
                                    <Clock className="h-4 w-4 text-blue-600" />
                                 </div>
                                 <p className="text-xs font-bold text-blue-700/80">
                                    {minutesRemaining !== null 
                                       ? `Session expires in approx. ${minutesRemaining} minutes.` 
                                       : "Session active. Changes will be reflected immediately after saving."}
                                 </p>
                              </motion.div>
                           )}

                           <div className="flex items-center gap-6 mt-8 pt-6 border-t border-[#F3F4F6]">
                              <div className="flex flex-col">
                                 <span className="text-2xl font-black text-[#10B981]">{presentCount}</span>
                                 <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">Present</span>
                              </div>
                              <div className="h-8 w-px bg-[#F3F4F6]" />
                              <div className="flex flex-col">
                                 <span className="text-2xl font-black text-red-500">{absentCount}</span>
                                 <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">Absent</span>
                              </div>
                              <div className="h-8 w-px bg-[#F3F4F6]" />
                              <div className="flex flex-col">
                                 <span className="text-2xl font-black text-[#374151]">{records.length}</span>
                                 <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">Total</span>
                              </div>
                           </div>
                        </div>
                     </Card>

                     {/* Student Search & List */}
                     <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                           <div className="relative flex-1">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                              <Input
                                 placeholder="Search by name, ID or enrollment number..."
                                 value={searchQuery}
                                 onChange={e => setSearchQuery(e.target.value)}
                                 className="pl-12 h-14 bg-white border-none ring-1 ring-[#E5E7EB] rounded-2xl shadow-sm focus-visible:ring-[#10B981]/50 focus-visible:ring-2 font-medium text-[#374151]"
                              />
                           </div>
                        </div>

                        {isStudentsLoading ? (
                           <div className="flex flex-col items-center justify-center h-64 bg-white rounded-[2.5rem] border border-[#E5E7EB] gap-4 shadow-sm">
                              <div className="h-10 w-10 rounded-2xl bg-[#F9FAFB] flex items-center justify-center border border-[#E5E7EB]">
                                 <Loader2 className="h-5 w-5 animate-spin text-[#10B981]" />
                              </div>
                              <p className="text-xs font-black text-[#9CA3AF] uppercase tracking-widest">Loading student list...</p>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {filteredRecords.map((record, index) => {
                                 const effectiveStatus = getEffectiveStatus(record);
                                 const isChanged = changes[record.id] !== undefined;

                                 return (
                                    <motion.div
                                       key={record.id}
                                       initial={{ opacity: 0, y: 10 }}
                                       animate={{ opacity: 1, y: 0 }}
                                       transition={{ delay: index * 0.01 }}
                                       className={`
                                          group relative p-5 rounded-[2rem] border transition-all duration-300
                                          ${effectiveStatus === 'present' 
                                             ? 'bg-white border-[#10B981]/20 shadow-md shadow-[#10B981]/5' 
                                             : 'bg-white border-[#E5E7EB] hover:border-[#D1D5DB]'
                                          }
                                          ${isChanged ? 'ring-2 ring-blue-500/20 shadow-lg' : ''}
                                       `}
                                    >
                                       <div className="flex items-center gap-4">
                                          <div className={`
                                             h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 transition-colors
                                             ${effectiveStatus === 'present' ? 'bg-[#10B981] text-white' : 'bg-[#F3F4F6] text-[#6B7280] group-hover:bg-[#E5E7EB]'}
                                          `}>
                                             {(record.name || record.username || '?').charAt(0).toUpperCase()}
                                          </div>
                                          
                                          <div className="flex-1 min-w-0">
                                             <div className="flex items-center gap-2">
                                                <p className="text-sm font-black text-[#374151] truncate">{record.name || record.username}</p>
                                                {isChanged && (
                                                   <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                                )}
                                             </div>
                                             <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-tighter mt-0.5 truncate">
                                                ID: {record.enroll_no || record.username}
                                             </p>
                                          </div>
                                       </div>

                                       <div className="grid grid-cols-5 gap-1.5 mt-5 pt-4 border-t border-[#F3F4F6]">
                                          {statusOptions.map(opt => {
                                             const isActive = effectiveStatus === opt.key;
                                             return (
                                                <button
                                                   key={opt.key}
                                                   disabled={isLocked}
                                                   onClick={() => setStatus(record.id, opt.key)}
                                                   className={`
                                                      px-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1
                                                      ${isActive 
                                                         ? 'bg-[#374151] text-white shadow-lg' 
                                                         : 'bg-[#F9FAFB] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#6B7280]'
                                                      }
                                                      ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                                                   `}
                                                >
                                                   <span className={isActive ? "text-white" : "text-[#D1D5DB]"}>{opt.icon}</span>
                                                   <span className="scale-90">{opt.label}</span>
                                                </button>
                                             );
                                          })}
                                       </div>
                                    </motion.div>
                                 );
                              })}
                           </div>
                        )}
                     </div>

                     {/* Save Action Bar */}
                     {!isLocked && hasChanges && (
                        <motion.div
                           initial={{ opacity: 0, y: 50 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50"
                        >
                           <Card className="bg-[#374151] border-none shadow-2xl rounded-[2rem] p-4 text-white overflow-hidden relative">
                              <div className="flex items-center justify-between gap-4 relative z-10">
                                 <div className="flex-1">
                                    <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Pending Changes</p>
                                    <p className="text-sm font-black">{Object.keys(changes).length} Profiles Modified</p>
                                 </div>
                                 <Button
                                    size="lg"
                                    className="bg-[#10B981] hover:bg-[#0D9668] text-white font-black rounded-2xl px-6 min-w-[140px] shadow-lg shadow-emerald-500/20"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                 >
                                    {isSaving ? (
                                       <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                       <>
                                          <Save className="h-4 w-4 mr-2" />
                                          Commit
                                       </>
                                    )}
                                 </Button>
                              </div>
                              <div className="absolute top-0 right-0 h-32 w-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                           </Card>
                        </motion.div>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
   );
}
