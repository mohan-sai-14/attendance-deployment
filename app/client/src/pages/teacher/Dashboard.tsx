import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  X,
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
          .eq('date', todayDate);

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
          if (matchingSession) {
            attendanceStatus = 'taken';
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
            attendanceSubmittedAt: matchingSession?.created_at || null,
            sessionId: matchingSession?.id || null,
          };
        });

        setTodaySchedule(schedule);

        // Find active QR session for today
        const activeSession = (sessionsData || []).find(
          s => s.is_active && s.qr_code && classIds.includes(s.class_id)
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

    fetchTodaySchedule();
  }, [user?.username, todayName, todayDate, toast]);

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
    <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold mt-1 text-foreground">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.first_name || user?.name || 'Teacher'}
        </h1>
      </motion.div>

      {/* ── SECTION 1: Now / Next Class ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <Card className="border-border/40 shadow-lg overflow-hidden relative">
          {/* Accent bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 ${currentClass ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600'}`} />

          <CardContent className="pt-8 pb-6 px-6">
            {currentClass ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/30" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Current Class
                  </span>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    {currentClass.timetableEntry?.subject_name}
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    {formatClassInfo(currentClass.classInfo)}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Timer className="h-4 w-4" />
                    <span>
                      {currentClass.label} ({formatTime12h(currentClass.startTime)} – {formatTime12h(currentClass.endTime)})
                    </span>
                  </div>
                </div>

                {currentClass.attendanceStatus === 'taken' ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      Attendance already taken
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-xs"
                      onClick={() => navigate(`/teacher/edit-attendance/${currentClass.sessionId}`)}
                    >
                      <FileEdit className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    onClick={() => navigate('/teacher/start-attendance')}
                  >
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Start Attendance
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-7 w-7 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">
                  No active class right now
                </h2>
                {nextClass ? (
                  <p className="text-muted-foreground mt-1.5 text-sm">
                    Next class starts at{' '}
                    <span className="font-semibold text-foreground">
                      {formatTime12h(nextClass.startTime)}
                    </span>
                    <span className="mx-1.5">·</span>
                    {nextClass.timetableEntry?.subject_name}
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1.5 text-sm">
                    No more classes scheduled for today
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── LIVE QR CODE WIDGET ── */}
      {activeQrSession && activeQrSession.qr_code && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <Card className="border-border/40 shadow-lg overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardContent className="pt-6 pb-5 px-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QrCodeIcon className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Live QR Code
                  </h3>
                  {qrTimeLeft && qrTimeLeft !== 'Expired' && (
                    <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0">
                      <Timer className="h-3 w-3 mr-1" />
                      {qrTimeLeft}
                    </Badge>
                  )}
                  {qrTimeLeft === 'Expired' && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Expired
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] px-2.5"
                  onClick={() => setShowQrExpanded(true)}
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-1" />
                  Expand
                </Button>
              </div>

              <div className="flex items-center gap-5">
                {/* Small QR preview */}
                <div
                  className="w-28 h-28 border-2 border-primary/20 p-2 rounded-xl bg-white shadow-md cursor-pointer hover:shadow-lg transition-shadow shrink-0"
                  onClick={() => setShowQrExpanded(true)}
                >
                  <QRCodeSVG
                    value={rotatingQrValue || activeQrSession.qr_code}
                    size={96}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{activeQrSession.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Students can scan this QR code to mark attendance
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => setShowQrExpanded(true)}
                    >
                      <QrCodeIcon className="h-3.5 w-3.5 mr-1" />
                      Show Full QR
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2.5"
                      onClick={() => navigate(`/teacher/edit-attendance/${activeQrSession.id}`)}
                    >
                      <FileEdit className="h-3.5 w-3.5 mr-1" />
                      Edit Attendance
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── QR EXPAND DIALOG ── */}
      <Dialog open={showQrExpanded} onOpenChange={setShowQrExpanded}>
        <DialogContent className="max-w-sm p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{activeQrSession?.name}</h3>
                {qrTimeLeft && qrTimeLeft !== 'Expired' && (
                  <p className="text-blue-100 text-sm mt-0.5 flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" />
                    Expires in {qrTimeLeft}
                  </p>
                )}
                {qrTimeLeft === 'Expired' && (
                  <p className="text-red-200 text-sm mt-0.5">QR Code has expired</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full"
                onClick={() => setShowQrExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center p-6 bg-white">
            {activeQrSession?.qr_code && (
              <div className="relative">
                <QRCodeSVG
                  value={rotatingQrValue || activeQrSession.qr_code}
                  size={280}
                  level="H"
                  includeMargin={true}
                />
                {qrTimeLeft === 'Expired' && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center rounded-lg">
                    <Badge variant="destructive" className="text-lg py-1 px-4 shadow-lg">Expired</Badge>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t text-center">
            <p className="text-xs text-muted-foreground">Ask students to scan this QR code using their app</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SECTION 2: Today's Schedule ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Today's Schedule
          </h3>
        </div>

        <div className="space-y-1.5">
          {todaySchedule.map((period, index) => {
            if (period.type === 'break') {
              return (
                <motion.div
                  key={period.slotId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="flex items-center gap-3 px-4 py-1.5"
                >
                  <div className="w-[52px]" />
                  <div className="flex-1 border-t border-dashed border-border/50" />
                  <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    {period.label}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/50" />
                  <div className="w-5" />
                </motion.div>
              );
            }

            const isOngoing = period.attendanceStatus === 'ongoing';
            const hasClass = !!period.timetableEntry;

            return (
              <motion.div
                key={period.slotId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index }}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isOngoing ? 'bg-amber-500/5 border border-amber-500/20 shadow-sm' : 'hover:bg-muted/40'}
                  ${hasClass ? 'cursor-pointer' : 'opacity-50'}
                `}
                onClick={() => {
                  if (!hasClass) return;
                  if (period.attendanceStatus === 'taken' && period.sessionId) {
                    navigate(`/teacher/edit-attendance/${period.sessionId}`);
                  } else if (period.attendanceStatus === 'ongoing') {
                    navigate('/teacher/start-attendance');
                  }
                }}
              >
                {/* Time */}
                <div className="w-[52px] text-right shrink-0">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatTime12h(period.startTime).replace(' ', '\n').split('\n')[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-0.5">
                    {formatTime12h(period.startTime).split(' ')[1]}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {hasClass ? period.timetableEntry!.subject_name : 'Free Period'}
                    </span>
                    {isOngoing && (
                      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0">
                        Now
                      </Badge>
                    )}
                  </div>
                  {hasClass && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {formatClassInfo(period.classInfo)} · {period.label}
                    </p>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="shrink-0 flex items-center gap-3">
                  {hasClass ? (
                    <>
                      <div className="flex items-center gap-1.5 hidden sm:flex">
                        {getStatusIcon(period.attendanceStatus)}
                        <span className="text-[11px] text-muted-foreground hidden md:inline">
                          {getStatusLabel(period.attendanceStatus)}
                        </span>
                      </div>

                      {period.attendanceStatus === 'taken' && period.sessionId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2.5 bg-background border-border/50 hover:bg-muted font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/teacher/edit-attendance/${period.sessionId}`);
                          }}
                        >
                          Edit
                        </Button>
                      ) : (period.attendanceStatus === 'not_taken' || period.attendanceStatus === 'ongoing') ? (
                        <Button
                          size="sm"
                          className="h-7 text-[11px] px-2.5 shadow-xs font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/teacher/start-attendance', { state: { slotId: period.slotId } });
                          }}
                        >
                          Take Attendance
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">–</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── SECTION 3: Quick Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Quick Actions
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="justify-start h-auto py-3.5 px-4 border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
            onClick={() => navigate('/teacher/attendance-history')}
          >
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
              <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium block">Today's Attendance</span>
              <span className="text-[11px] text-muted-foreground">View records</span>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3.5 px-4 border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
            onClick={() => navigate('/teacher/timetable')}
          >
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
              <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium block">My Timetable</span>
              <span className="text-[11px] text-muted-foreground">Weekly view</span>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3.5 px-4 border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
            onClick={() => navigate('/teacher/manual-attendance')}
          >
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
              <FileEdit className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium block">Request Correction</span>
              <span className="text-[11px] text-muted-foreground">Edit attendance</span>
            </div>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
