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

        const { data: sessionsData } = await supabase.from('sessions').select('*').eq('date', todayDate);

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
            is_active: false,
            class_id: selectedPeriod.entry.class_id,
            section: selectedPeriod.classInfo.section,
            expires_at: new Date().toISOString(),
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
    <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-5">
      {/* Back + Header */}
      <Button
        variant="ghost"
        className="mb-1"
        onClick={() => selectedPeriod ? (() => { setSelectedPeriod(null); setRecords([]); setChanges({}); })() : navigate('/teacher/dashboard')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {selectedPeriod ? 'Back to Classes' : 'Back'}
      </Button>

      <AnimatePresence mode="wait">
        {!selectedPeriod ? (
          /* ── CLASS CARDS ── */
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-3"
          >
            <h1 className="text-2xl font-bold text-foreground mb-1">Manual Attendance</h1>
            <p className="text-sm text-muted-foreground mb-4">Select a class to edit attendance</p>

            {periodCards.length === 0 ? (
              <Card className="border-border/40 shadow-lg">
                <CardContent className="pt-8 pb-8 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">No Classes Today</h2>
                  <p className="text-muted-foreground mt-2 text-sm">You have no classes assigned for today.</p>
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`border-border/40 shadow-md cursor-pointer transition-all hover:shadow-lg hover:border-primary/30 overflow-hidden ${locked ? 'opacity-60' : ''}`}
                      onClick={() => handleSelectPeriod(card)}
                    >
                      <div className={`h-1 ${isOngoing ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : hasTaken ? (locked ? 'bg-gradient-to-r from-red-400 to-orange-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500') : 'bg-gradient-to-r from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600'}`} />
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{card.classInfo.section}</h3>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{card.slot.label}</Badge>
                              {isOngoing && (
                                <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0">
                                  <Clock className="h-3 w-3 mr-0.5" /> Ongoing
                                </Badge>
                              )}
                              {hasTaken && (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0">
                                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Taken
                                </Badge>
                              )}
                              {locked && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  <Lock className="h-3 w-3 mr-0.5" /> Locked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">Subject: {card.entry.subject_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {formatTime12h(card.slot.start)} – {formatTime12h(card.slot.end)}
                              <span className="mx-1">·</span>
                              {card.classInfo.department} {card.classInfo.program} {card.classInfo.year}
                            </p>
                          </div>
                          <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        ) : (
          /* ── EDIT ATTENDANCE VIEW (mirrors EditAttendance.tsx) ── */
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-5"
          >
            {/* Session Info + Lock Status */}
            <Card className="border-border/40 shadow-sm overflow-hidden">
              <div className={`h-1 ${isLocked ? 'bg-gradient-to-r from-red-400 to-orange-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} />
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {selectedPeriod.entry.subject_name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedPeriod.classInfo.program} {selectedPeriod.classInfo.year} – Sec {selectedPeriod.classInfo.section}
                      <span className="mx-1.5">·</span>
                      {selectedPeriod.slot.label}
                      <span className="mx-1.5">·</span>
                      {formatTime12h(selectedPeriod.slot.start)} – {formatTime12h(selectedPeriod.slot.end)}
                    </p>
                  </div>
                  {isLocked ? (
                    <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                      <Lock className="h-3 w-3 mr-1" /> Locked
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                      <Unlock className="h-3 w-3 mr-1" /> Editable
                    </Badge>
                  )}
                </div>

                {/* Lock/Edit banner */}
                <div className={`mt-4 p-3 rounded-lg border ${isLocked ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                  <div className="flex items-center gap-2">
                    {isLocked ? (
                      <>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-red-700 dark:text-red-400">
                          Attendance locked. Contact admin for changes.
                        </span>
                      </>
                    ) : minutesRemaining !== null ? (
                      <>
                        <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-700 dark:text-blue-400">
                          Editable for {minutesRemaining} more minute{minutesRemaining !== 1 ? 's' : ''}.
                        </span>
                      </>
                    ) : (
                      <>
                        <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-700 dark:text-blue-400">
                          New session — click students to mark present.
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="outline" className="text-xs">{presentCount} Present</Badge>
                  <Badge variant="outline" className="text-xs">{absentCount} Absent</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Records */}
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Attendance Records</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isStudentsLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                    {filteredRecords.map((record, index) => {
                      const effectiveStatus = getEffectiveStatus(record);
                      const isChanged = changes[record.id] !== undefined;

                      return (
                        <motion.div
                          key={record.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.02 }}
                          className={`
                            flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors
                            ${isChanged ? 'ring-1 ring-primary/30 bg-primary/5' : ''}
                            ${effectiveStatus === 'absent' ? 'bg-red-500/5' : 'hover:bg-muted/30'}
                          `}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`
                              h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0
                              ${effectiveStatus === 'present' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : effectiveStatus === 'late' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                  : effectiveStatus === 'od' ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400'
                                    : effectiveStatus === 'ml' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                      : 'bg-red-500/10 text-red-700 dark:text-red-400'}
                            `}>
                              {(record.name || record.username || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{record.name || record.username || 'Unknown'}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{record.enroll_no || record.username || 'No ID'}</p>
                            </div>
                          </div>
                          <div className="shrink-0 ml-2 flex items-center gap-1">
                            {isChanged && <span className="text-[10px] text-primary font-medium mr-1">Modified</span>}
                            {statusOptions.map(opt => (
                              <button
                                key={opt.key}
                                disabled={isLocked}
                                onClick={() => setStatus(record.id, opt.key)}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-0.5 ${effectiveStatus === opt.key
                                  ? opt.color + ' shadow-sm ring-1 ring-black/5'
                                  : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                {opt.icon}
                                <span className="hidden sm:inline ml-0.5">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save button */}
            {!isLocked && hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky bottom-4"
              >
                <Button
                  size="lg"
                  className="w-full shadow-lg"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-5 w-5 mr-2" /> Save Changes ({Object.keys(changes).length} modified)</>
                  )}
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
