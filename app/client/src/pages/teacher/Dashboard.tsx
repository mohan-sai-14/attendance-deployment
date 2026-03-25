import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  CalendarDays,
  ClipboardList,
  ArrowRight,
  Loader2,
  BookOpen,
  Timer,
  Hourglass,
  FileEdit,
  QrCode as QrCodeIcon,
  Maximize2,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { generateQRToken } from '@/lib/qr-token';

// Time slots from timetable system 
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

interface PeriodSchedule {
  slotId: string;
  label: string;
  startTime: string;
  endTime: string;
  type: 'period' | 'break';
  timetableEntry: TimetableEntry | null;
  classInfo: ClassInfo | null;
  attendanceStatus: 'taken' | 'ongoing' | 'not_taken' | 'no_class';
  attendanceSubmittedAt: string | null;
  sessionId: string | null;
  matchingSession?: any | null;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [todaySchedule, setTodaySchedule] = useState<PeriodSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(getCurrentTimeMinutes());
  const [activeQrSession, setActiveQrSession] = useState<any>(null);
  const [showQrExpanded, setShowQrExpanded] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState('');
  const [rotatingQrValue, setRotatingQrValue] = useState('');

  const todayName = DAYS_OF_WEEK[new Date().getDay()];
  const todayDate = new Date().toISOString().split('T')[0];

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // QR countdown timer
  useEffect(() => {
    if (!activeQrSession?.expires_at) {
      setQrTimeLeft('');
      return;
    }
    const tick = () => {
      const now = new Date();
      const expires = new Date(activeQrSession.expires_at);
      const diff = expires.getTime() - now.getTime();
      if (diff <= 0) {
        setQrTimeLeft('Expired');
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setQrTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeQrSession]);

  // Rotating QR code every 5 seconds on Dashboard
  useEffect(() => {
    if (!activeQrSession?.qr_secret || !activeQrSession?.qr_code) return;

    const rotateQR = async () => {
      if (activeQrSession.expires_at && Date.now() >= new Date(activeQrSession.expires_at).getTime()) return;

      try {
        const parsed = JSON.parse(activeQrSession.qr_code);
        if (!parsed.sessionId) return;

        const token = await generateQRToken(parsed.sessionId, activeQrSession.qr_secret, {
          name: activeQrSession.name,
          date: activeQrSession.date,
          time: activeQrSession.time,
          duration: activeQrSession.duration,
        });
        setRotatingQrValue(token);
      } catch (e) {
        console.error('Error rotating Dashboard QR:', e);
      }
    };

    const interval = setInterval(rotateQR, 5000);
    return () => clearInterval(interval);
  }, [activeQrSession]);

  // Fetch teacher's timetable for today + attendance status
  useEffect(() => {
    const fetchTodaySchedule = async () => {
      if (!user?.username) return;

      try {
        setIsLoading(true);

        // Fetch timetable entries for today for this teacher
        const { data: timetableData, error: ttError } = await supabase
          .from('timetables')
          .select('*')
          .eq('faculty_id', user.username)
          .eq('day_of_week', todayName);

        if (ttError) throw ttError;

        // Fetch classes for the timetable entries
        const classIds = Array.from(new Set((timetableData || []).map(t => t.class_id)));
        let classesMap: Record<string, ClassInfo> = {};

        if (classIds.length > 0) {
          const { data: classesData, error: classError } = await supabase
            .from('classes')
            .select('*')
            .in('id', classIds);

          if (classError) throw classError;
          classesMap = (classesData || []).reduce((acc, cls) => {
            acc[cls.id] = cls;
            return acc;
          }, {} as Record<string, ClassInfo>);
        }

        // Fetch today's attendance sessions
        const { data: sessionsData, error: sessError } = await supabase
          .from('sessions')
          .select('*')
          .eq('date', todayDate)
          .eq('created_by', user.id);

        if (sessError) throw sessError;

        // Build the schedule with time slots
        const nowMinutes = getCurrentTimeMinutes();
        const periodSlots = DEFAULT_TIME_SLOTS;

        const schedule: PeriodSchedule[] = periodSlots.map(slot => {
          if (slot.type === 'break') {
            return {
              slotId: slot.id,
              label: slot.label,
              startTime: slot.start,
              endTime: slot.end,
              type: 'break',
              timetableEntry: null,
              classInfo: null,
              attendanceStatus: 'no_class',
              attendanceSubmittedAt: null,
              sessionId: null,
            };
          }

          // Find timetable entry matching this slot
          const entry = (timetableData || []).find(t => {
            const ttStart = t.start_time?.substring(0, 5);
            return ttStart === slot.start;
          });

          if (!entry) {
            return {
              slotId: slot.id,
              label: slot.label,
              startTime: slot.start,
              endTime: slot.end,
              type: 'period',
              timetableEntry: null,
              classInfo: null,
              attendanceStatus: 'no_class',
              attendanceSubmittedAt: null,
              sessionId: null,
            };
          }

          // Find matching session for this slot
          const matchingSession = (sessionsData || []).find(s => {
            const sessionTime = s.time?.substring(0, 5);
            return sessionTime === slot.start && s.class_id === entry.class_id;
          });

          const slotStart = timeToMinutes(slot.start);
          const slotEnd = timeToMinutes(slot.end);

          let attendanceStatus: PeriodSchedule['attendanceStatus'] = 'not_taken';
          const session = matchingSession;
          if (session) {
            attendanceStatus = 'taken';
            // If session is inactive, it's effectively "completed" or "locked"
            if (!session.is_active) {
              attendanceStatus = 'taken'; // Keep as taken, but we'll use session.is_active for the badge
            }
          } else if (nowMinutes >= slotStart && nowMinutes < slotEnd) {
            attendanceStatus = 'ongoing';
          }

          return {
            slotId: slot.id,
            label: slot.label,
            startTime: slot.start,
            endTime: slot.end,
            type: 'period',
            timetableEntry: entry,
            classInfo: classesMap[entry.class_id] || null,
            attendanceStatus,
            attendanceSubmittedAt: session?.created_at || null,
            sessionId: session?.id || null,
            matchingSession: session,
          };
        });

        setTodaySchedule(schedule);

        // Find active QR session for today
        const activeSession = (sessionsData || []).find(
          s => s.is_active && s.qr_code && classIds.includes(s.class_id) && String(s.created_by) === String(user.id)
        );
        setActiveQrSession(activeSession || null);
        
        // Initialize rotating QR value
        if (activeSession?.qr_secret && activeSession.qr_code) {
          try {
            const parsed = JSON.parse(activeSession.qr_code);
            if (parsed.sessionId) {
              const token = await generateQRToken(parsed.sessionId, activeSession.qr_secret, {
                name: activeSession.name,
                date: activeSession.date,
                time: activeSession.time,
                duration: activeSession.duration,
              });
              setRotatingQrValue(token);
            } else {
              setRotatingQrValue(activeSession.qr_code);
            }
          } catch {
            setRotatingQrValue(activeSession.qr_code);
          }
        } else if (activeSession?.qr_code) {
          setRotatingQrValue(activeSession.qr_code);
        }
      } catch (error) {
        console.error('Error fetching teacher schedule:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load your schedule',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id) {
        fetchTodaySchedule();
    }
  }, [user?.id, todayName, todayDate, toast]);

  // Derive current and next class
  const { currentClass, nextClass } = useMemo(() => {
    const nowMinutes = currentTime;
    const periodSlots = todaySchedule.filter(s => s.type === 'period' && s.timetableEntry);

    let current: PeriodSchedule | null = null;
    let next: PeriodSchedule | null = null;

    for (const slot of periodSlots) {
      const start = timeToMinutes(slot.startTime);
      const end = timeToMinutes(slot.endTime);

      if (nowMinutes >= start && nowMinutes < end) {
        current = slot;
      } else if (nowMinutes < start && !next) {
        next = slot;
      }
    }

    return { currentClass: current, nextClass: next };
  }, [todaySchedule, currentTime]);

  const getStatusIcon = (status: PeriodSchedule['attendanceStatus']) => {
    switch (status) {
      case 'taken':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'ongoing':
        return <Hourglass className="h-5 w-5 text-amber-500 animate-pulse" />;
      case 'not_taken':
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  const getStatusLabel = (status: PeriodSchedule['attendanceStatus']) => {
    switch (status) {
      case 'taken': return 'Attendance Taken';
      case 'ongoing': return 'Ongoing';
      case 'not_taken': return 'Not Taken';
      default: return 'No Class';
    }
  };

  const formatClassInfo = (classInfo: ClassInfo | null) => {
    if (!classInfo) return '';
    return `${classInfo.program} ${classInfo.year} – Sec ${classInfo.section}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your schedule...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-12">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
        {/* Greeting & Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4"
        >
          <div>
            <p className="text-[#6B7280] text-xs font-semibold uppercase tracking-widest">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-3xl font-extrabold mt-1 text-[#374151]">
              Welcome, {user?.first_name || user?.name || 'Faculty'}
            </h1>
            <p className="text-[#6B7280] text-sm mt-1">Manage your sessions and attendance effectively.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-full shadow-sm">
            <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-xs font-medium text-[#374151]">System Sync Active</span>
          </div>
        </motion.div>

        {/* ── SECTION 1: Now / Next Class ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <Card className="border-[#E5E7EB] bg-white shadow-sm overflow-hidden border-none ring-1 ring-[#E5E7EB]">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#E5E7EB]">
                {/* Current Class Main View */}
                <div className="flex-1 p-6 sm:p-8">
                  {currentClass ? (
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#059669] border border-[#10B981]/20">
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Session Active Now</span>
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-[#374151]">
                          {currentClass.timetableEntry?.subject_name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6B7280]">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {formatClassInfo(currentClass.classInfo)}
                          </span>
                          <span className="text-[#E5E7EB]">|</span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {currentClass.label} ({formatTime12h(currentClass.startTime)} – {formatTime12h(currentClass.endTime)})
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        {currentClass.attendanceStatus === 'taken' ? (
                          <div className="flex items-center gap-3 w-full bg-[#F3F4F6] p-4 rounded-xl border border-[#E5E7EB]">
                            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#10B981]">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-[#374151]">Records captured</p>
                              <p className="text-xs text-[#6B7280]">Attendance is already synced for this period.</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white border-[#E5E7EB] text-xs font-bold hover:bg-[#F9FAFB] hover:text-[#374151]"
                              onClick={() => navigate(`/teacher/edit-attendance/${currentClass.sessionId}`)}
                            >
                              <FileEdit className="h-3.5 w-3.5 mr-1" />
                              Update
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="lg"
                            className="w-full sm:w-auto px-8 bg-[#374151] hover:bg-[#1F2937] text-white shadow-lg transition-all duration-200 rounded-xl"
                            onClick={() => navigate('/teacher/start-attendance')}
                          >
                            <PlayCircle className="h-5 w-5 mr-2" />
                            Start QR Attendance
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                      <div className="h-16 w-16 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF]">
                        <Hourglass className="h-8 w-8" />
                      </div>
                      <div className="max-w-xs">
                        <h2 className="text-lg font-bold text-[#374151]">No active period right now</h2>
                        <p className="text-sm text-[#6B7280] mt-1 italic">Your current assignments will appear here automatically.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Side: Next Class / Status Mini View */}
                <div className="w-full md:w-64 bg-[#F9FAFB] p-6 flex flex-col justify-center">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Next Assignment</p>
                    {nextClass ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
                          <p className="text-xs font-bold text-[#374151] line-clamp-1">
                            {nextClass.timetableEntry?.subject_name}
                          </p>
                          <p className="text-[10px] text-[#6B7280] mt-0.5">
                            Starts at {formatTime12h(nextClass.startTime)}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs text-[#374151] hover:bg-white hover:shadow-sm h-8"
                          onClick={() => navigate('/teacher/timetable')}
                        >
                          View Timetable <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <p className="text-xs text-[#9CA3AF] italic">All classes completed for today.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── LIVE QR CODE WIDGET ── */}
        <AnimatePresence>
          {activeQrSession && activeQrSession.qr_code && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-none ring-1 ring-[#10B981]/30 bg-white shadow-xl shadow-[#10B981]/5 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-1 p-6 md:p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
                            <QrCodeIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#374151]">LIVE ATTENDANCE SYNC</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              {qrTimeLeft && qrTimeLeft !== 'Expired' && (
                                <Badge variant="outline" className="text-[10px] font-bold border-[#10B981]/20 bg-[#10B981]/5 text-[#059669] flex items-center gap-1 py-0">
                                  <Timer className="h-2.5 w-2.5" /> {qrTimeLeft} REMAINING
                                </Badge>
                              )}
                              {qrTimeLeft === 'Expired' && (
                                <Badge variant="destructive" className="text-[10px] py-0">EXPIRED</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full hover:bg-[#F3F4F6]"
                          onClick={() => setShowQrExpanded(true)}
                        >
                          <Maximize2 className="h-4 w-4 text-[#6B7280]" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <p className="text-sm text-[#374151] font-medium leading-tight">
                          Students are currently scanning for <span className="font-extrabold">{activeQrSession.name}</span>
                        </p>
                        <ul className="space-y-2">
                           <li className="flex items-center gap-2 text-xs text-[#6B7280]">
                             <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                             Code rotates every 5s for security
                           </li>
                           <li className="flex items-center gap-2 text-xs text-[#6B7280]">
                             <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                             Location proximity enforced
                           </li>
                        </ul>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          className="bg-[#374151] hover:bg-[#1F2937] text-white rounded-xl text-xs h-9 px-4"
                          onClick={() => setShowQrExpanded(true)}
                        >
                          Fullscreen Mode
                        </Button>
                      </div>
                    </div>

                    <div className="bg-[#10B981]/5 p-8 flex items-center justify-center border-t md:border-t-0 md:border-l border-[#E5E7EB]">
                      <div
                        className="p-4 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setShowQrExpanded(true)}
                      >
                        <QRCodeSVG
                          value={rotatingQrValue || activeQrSession.qr_code}
                          size={160}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SECTION 2: Today's Schedule ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Today's Academic Schedule</h3>
            <span className="text-[10px] text-[#9CA3AF] font-medium italic">Auto-syncs with Master Timetable</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {todaySchedule.map((period, index) => {
              if (period.type === 'break') {
                return (
                  <div key={period.slotId} className="flex items-center gap-4 py-2 opacity-40 grayscale group">
                    <div className="w-16 h-px bg-[#E5E7EB]" />
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-[#9CA3AF]">
                      {period.label}
                    </span>
                    <div className="flex-1 h-px bg-[#E5E7EB]" />
                  </div>
                );
              }

              const isOngoing = period.attendanceStatus === 'ongoing';
              const hasClass = !!period.timetableEntry;
              const isTaken = period.attendanceStatus === 'taken';

              return (
                <motion.div
                  key={period.slotId}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * index }}
                >
                  <Card 
                    className={`group transition-all duration-200 border-none ring-1 ring-[#E5E7EB] hover:ring-[#D1D5DB] hover:shadow-md ${
                      isOngoing ? 'ring-[#10B981]/40 bg-[#10B981]/[0.02]' : 'bg-white'
                    } ${!hasClass ? 'opacity-60 grayscale' : ''}`}
                  >
                    <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                      {/* Status Icon Indicator */}
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                        isTaken ? 'bg-[#10B981]/10 text-[#10B981]' 
                        : isOngoing ? 'bg-[#374151] text-white animate-pulse'
                        : hasClass ? 'bg-[#F3F4F6] text-[#9CA3AF]' 
                        : 'bg-transparent text-[#E5E7EB]'
                      }`}>
                        {getStatusIcon(period.attendanceStatus)}
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#374151] truncate">
                            {hasClass ? period.timetableEntry!.subject_name : 'No Session'}
                          </h4>
                          {isOngoing && (
                            period.matchingSession ? (
                              period.matchingSession.is_active ? (
                                <Badge className="bg-[#10B981] text-white text-[9px] h-4 rounded-md">ACTIVE</Badge>
                              ) : (
                                <Badge className="bg-[#374151] text-white text-[9px] h-4 rounded-md">COMPLETED</Badge>
                              )
                            ) : (
                              <Badge className="bg-[#10B981] text-white text-[9px] h-4 rounded-md">ACTIVE</Badge>
                            )
                          )}
                          {!isOngoing && isTaken && (
                            <Badge className="bg-[#374151] text-white text-[9px] h-4 rounded-md">RECORDED</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#6B7280] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[#4B5563]">{formatTime12h(period.startTime)} – {formatTime12h(period.endTime)}</span>
                          {hasClass && (
                            <>
                              <span className="text-[#D1D5DB]">•</span>
                              <span className="truncate">{formatClassInfo(period.classInfo)}</span>
                              <span className="text-[#D1D5DB]">•</span>
                              <span>{period.label}</span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0 flex items-center gap-2">
                        {isTaken ? (
                          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-[#F3F4F6] border border-[#E5E7EB]">
                            <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                            <span className="text-[10px] font-bold text-[#6B7280] uppercase">Logged</span>
                          </div>
                        ) : null}
                        
                        {hasClass && (
                          <Button
                            variant={isOngoing ? "default" : "outline"}
                            size="sm"
                            className={`h-8 text-xs font-bold rounded-lg px-4 ${
                              isOngoing ? "bg-[#374151] hover:bg-[#1F2937] text-white shadow-sm" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                            }`}
                            onClick={() => {
                              if (isTaken && period.sessionId) {
                                navigate(`/teacher/edit-attendance/${period.sessionId}`);
                              } else if (isOngoing) {
                                navigate('/teacher/start-attendance');
                              } else {
                                navigate('/teacher/start-attendance', { state: { slotId: period.slotId } });
                              }
                            }}
                          >
                            {isTaken ? (period.matchingSession?.is_active === false ? "Completed" : "Taken") : isOngoing ? "Attend" : "Open"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 3: Bottom Actions Tray ── */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="flex flex-col items-start gap-1 h-auto p-5 border-none ring-1 ring-[#E5E7EB] bg-white hover:ring-[#D1D5DB] hover:shadow-md transition-all rounded-2xl group"
            onClick={() => navigate('/teacher/attendance-history')}
          >
            <div className="h-10 w-10 rounded-xl bg-blue-500/5 flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="text-left mt-2">
              <span className="text-xs font-bold text-[#374151] block">History & Reports</span>
              <span className="text-[10px] text-[#9CA3AF]">Past session data</span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex flex-col items-start gap-1 h-auto p-5 border-none ring-1 ring-[#E5E7EB] bg-white hover:ring-[#D1D5DB] hover:shadow-md transition-all rounded-2xl group"
            onClick={() => navigate('/teacher/manual-attendance')}
          >
            <div className="h-10 w-10 rounded-xl bg-amber-500/5 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
              <FileEdit className="h-5 w-5" />
            </div>
            <div className="text-left mt-2">
              <span className="text-xs font-bold text-[#374151] block">Manual Entry</span>
              <span className="text-[10px] text-[#9CA3AF]">Correction & overrides</span>
            </div>
          </Button>
        </div>
      </div>

      {/* ── QR EXPAND DIALOG ── */}
      <Dialog open={showQrExpanded} onOpenChange={setShowQrExpanded}>
        <DialogContent className="max-w-[90%] sm:max-w-[400px] md:max-w-[500px] p-0 gap-0 border-none shadow-xl overflow-hidden rounded-2xl bg-white focus:outline-none">
          {/* Header */}
          <div className="bg-[#374151] px-6 py-4 text-white text-center flex flex-col items-center gap-1.5 min-h-[80px]">
            <h3 className="font-extrabold text-lg tracking-tight uppercase">
              {activeQrSession?.name || "Attendance Session"}
            </h3>
            {qrTimeLeft && qrTimeLeft !== 'Expired' && (
              <Badge className="bg-white/10 text-white font-bold border-white/20 px-2.5 py-0.5 text-[10px] rounded-full">
                <Clock className="h-3 w-3 mr-1" />
                {qrTimeLeft} REMAINING
              </Badge>
            )}
          </div>

          {/* QR Content */}
          <div className="flex flex-col items-center justify-center p-8 md:p-12 bg-white gap-6">
            {activeQrSession?.qr_code && (
              <div className="relative group w-full flex justify-center">
                <div className="p-4 bg-[#F9FAFB] rounded-2xl shadow-inner ring-1 ring-black/5 w-fit max-w-full overflow-hidden">
                  <QRCodeSVG
                    value={rotatingQrValue || activeQrSession.qr_code}
                    size={Math.min(300, window.innerWidth * 0.7)}
                    level="H"
                    includeMargin={false}
                    className="block mx-auto max-w-full h-auto"
                  />
                </div>
                {qrTimeLeft === 'Expired' && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center rounded-2xl">
                    <XCircle className="h-12 w-12 text-red-500 mb-1" />
                    <span className="text-lg font-black text-red-500 uppercase tracking-tighter">Code Expired</span>
                  </div>
                )}
              </div>
            )}

            {/* Security Info */}
            <div className="w-full space-y-4">
              <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-center space-y-1">
                <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Security Instructions</p>
                <p className="text-[11px] text-[#6B7280]/70 font-medium italic leading-relaxed">
                  Students must scan this code using the mobile app within the classroom premises.
                </p>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowQrExpanded(false)} 
                className="w-full text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] rounded-xl font-bold uppercase text-[10px] tracking-widest"
              >
                Dismiss Preview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
