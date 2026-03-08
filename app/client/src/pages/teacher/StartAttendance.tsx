import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
   Form,
   FormControl,
   FormField,
   FormItem,
   FormLabel,
   FormMessage,
} from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { format, addMinutes } from "date-fns";
import {
   Clock,
   Loader2,
   ArrowLeft,
   QrCode as QrCodeIcon,
   MapPin,
   Timer,
   Edit,
   Calendar,
   AlertCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { QRCodeSVG } from 'qrcode.react';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentPosition } from '@/lib/location';
import { generateQRToken, generateSecret } from '@/lib/qr-token';

const DEFAULT_TIME_SLOTS = [
   { id: 'p1', label: 'Period 1', start: '09:00', end: '09:50', type: 'period' as const },
   { id: 'p2', label: 'Period 2', start: '09:50', end: '10:40', type: 'period' as const },
   { id: 'p3', label: 'Period 3', start: '11:00', end: '11:50', type: 'period' as const },
   { id: 'p4', label: 'Period 4', start: '11:50', end: '12:40', type: 'period' as const },
   { id: 'p5', label: 'Period 5', start: '13:30', end: '14:20', type: 'period' as const },
   { id: 'p6', label: 'Period 6', start: '14:20', end: '15:10', type: 'period' as const },
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

function formatTime12h(time24: string): string {
   const [h, m] = time24.split(':').map(Number);
   const ampm = h >= 12 ? 'PM' : 'AM';
   const hour = h % 12 || 12;
   return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function timeToMinutes(time: string): number {
   const [h, m] = time.split(':').map(Number);
   return h * 60 + m;
}

const formSchema = z.object({
   name: z.string().min(1, "Session name is required"),
   date: z.string().min(1, "Date is required"),
   time: z.string().min(1, "Time is required"),
   duration: z.coerce.number().min(1, "Duration must be at least 1 minute").max(180, "Duration cannot exceed 180 minutes"),
   expiresAt: z.string().min(1, "Expiration time is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function StartAttendance() {
   const navigate = useNavigate();
   const location = useLocation();
   const { user } = useAuth();
   const { toast } = useToast();

   const forcedSlotId = location.state?.slotId;

   const [currentEntry, setCurrentEntry] = useState<TimetableEntry | null>(null);
   const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
   const [currentSlot, setCurrentSlot] = useState<typeof DEFAULT_TIME_SLOTS[0] | null>(null);

   const [isLoading, setIsLoading] = useState(true);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isGettingLocation, setIsGettingLocation] = useState(false);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   const [qrValue, setQrValue] = useState('');
   const [qrSecret, setQrSecret] = useState('');
   const [qrRotationCount, setQrRotationCount] = useState(0);
   const [expiryTime, setExpiryTime] = useState<Date | null>(null);
   const [timeLeft, setTimeLeft] = useState('');
   const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
   const [showBottomBar, setShowBottomBar] = useState(false);
   const sessionIdRef = useRef<string>('');

   const form = useForm<FormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
         name: "",
         date: format(new Date(), 'yyyy-MM-dd'),
         time: format(new Date(), 'HH:mm'),
         duration: 50,
         expiresAt: format(addMinutes(new Date(), 5), "yyyy-MM-dd'T'HH:mm"),
      },
   });

   // Clear error message when form is changed
   useEffect(() => {
      const subscription = form.watch(() => {
         if (errorMessage) {
            setErrorMessage(null);
         }
      });
      return () => subscription.unsubscribe();
   }, [form, errorMessage]);

   // Show bottom bar on scroll
   useEffect(() => {
      const handleScroll = () => {
         setShowBottomBar(window.scrollY > 200);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
   }, []);

   // Detect current class from timetable
   useEffect(() => {
      const detectCurrentClass = async () => {
         if (!user?.username) return;

         try {
            setIsLoading(true);
            const todayName = DAYS_OF_WEEK[new Date().getDay()];
            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

            // Find current time slot
            let activeSlot;
            if (forcedSlotId) {
               activeSlot = DEFAULT_TIME_SLOTS.find(slot => slot.id === forcedSlotId);
            } else {
               activeSlot = DEFAULT_TIME_SLOTS.find(slot => {
                  const start = timeToMinutes(slot.start);
                  const end = timeToMinutes(slot.end);
                  return nowMinutes >= start && nowMinutes < end;
               });
            }

            if (!activeSlot) {
               const nextSlot = DEFAULT_TIME_SLOTS.find(slot => timeToMinutes(slot.start) > nowMinutes);
               if (nextSlot) setCurrentSlot(nextSlot);
               setIsLoading(false);
               return;
            }

            setCurrentSlot(activeSlot);

            // Fetch timetable entry for this teacher and time
            const { data: ttData, error: ttError } = await supabase
               .from('timetables')
               .select('*')
               .eq('faculty_id', user.username)
               .eq('day_of_week', todayName);

            if (ttError) throw ttError;

            const entry = (ttData || []).find(t => {
               const ttStart = t.start_time?.substring(0, 5);
               return ttStart === activeSlot.start;
            });

            if (!entry) {
               setIsLoading(false);
               return;
            }

            setCurrentEntry(entry);

            // Pre-fill form values
            const now = new Date();
            const slotDuration = timeToMinutes(activeSlot.end) - timeToMinutes(activeSlot.start);
            form.reset({
               name: `${entry.subject_name} - ${activeSlot.label}`,
               date: format(now, 'yyyy-MM-dd'),
               time: activeSlot.start,
               duration: slotDuration,
               expiresAt: format(addMinutes(now, 5), "yyyy-MM-dd'T'HH:mm"),
            });

            // Fetch class info
            const { data: classData, error: classError } = await supabase
               .from('classes')
               .select('*')
               .eq('id', entry.class_id)
               .single();

            if (classError) throw classError;
            setClassInfo(classData);

            // Check for an existing active session for this class today
            const todayDate = format(new Date(), 'yyyy-MM-dd');
            const { data: existingSession } = await supabase
               .from('sessions')
               .select('*')
               .eq('is_active', true)
               .eq('class_id', entry.class_id)
               .eq('date', todayDate)
               .order('created_at', { ascending: false })
               .limit(1)
               .maybeSingle();

            if (existingSession && existingSession.qr_code) {
               // Load existing session - get secret for rotation
               const secret = existingSession.qr_secret || '';
               setQrSecret(secret);
               sessionIdRef.current = existingSession.id;
               setExpiryTime(new Date(existingSession.expires_at));
               setCreatedSessionId(existingSession.id);
               
               // Parse sessionId from existing qr_code
               try {
                  const parsed = JSON.parse(existingSession.qr_code);
                  if (secret && parsed.sessionId) {
                     // Start rotating from this session
                     const token = await generateQRToken(parsed.sessionId, secret, {
                        name: existingSession.name,
                        date: existingSession.date,
                        time: existingSession.time,
                        duration: existingSession.duration,
                     });
                     setQrValue(token);
                  } else {
                     setQrValue(existingSession.qr_code);
                  }
               } catch {
                  setQrValue(existingSession.qr_code);
               }
            }

         } catch (error) {
            console.error('Error detecting class:', error);
            toast({
               variant: 'destructive',
               title: 'Error',
               description: 'Failed to detect current class',
            });
         } finally {
            setIsLoading(false);
         }
      };

      detectCurrentClass();
   }, [user?.username, toast, forcedSlotId, form]);

   // Countdown timer for QR
   useEffect(() => {
      if (!expiryTime) return;
      const interval = setInterval(() => {
         const now = new Date();
         const diff = expiryTime.getTime() - now.getTime();
         if (diff <= 0) {
            setTimeLeft('Expired');
            clearInterval(interval);
         } else {
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
         }
      }, 1000);
      return () => clearInterval(interval);
   }, [expiryTime]);

   // Rotating QR code every 5 seconds
   // Use refs to access latest values inside the interval without triggering re-effects
   const latestQrVal = useRef(qrValue);
   useEffect(() => { latestQrVal.current = qrValue; }, [qrValue]);

   useEffect(() => {
      if (!qrSecret || !sessionIdRef.current) return;

      const rotateQR = async () => {
         if (expiryTime && Date.now() >= expiryTime.getTime()) return;

         try {
            // Parse session data from current QR to keep metadata
            let extraData: Record<string, any> = {};
            try {
               const current = JSON.parse(latestQrVal.current);
               if (current.name) extraData.name = current.name;
               if (current.date) extraData.date = current.date;
               if (current.time) extraData.time = current.time;
               if (current.duration) extraData.duration = current.duration;
            } catch {}

            // Parse sessionId from qrValue
            let sid = sessionIdRef.current;
            try {
               const parsed = JSON.parse(latestQrVal.current);
               if (parsed.sessionId) sid = parsed.sessionId;
            } catch {}

            const newToken = await generateQRToken(sid, qrSecret, extraData);
            setQrValue(newToken);
            setQrRotationCount(c => c + 1);
         } catch (e) {
            console.error('Error rotating QR:', e);
         }
      };

      const interval = setInterval(rotateQR, 5000);
      return () => clearInterval(interval);
   }, [qrSecret, expiryTime]);

   const onSubmit = async (data: FormValues) => {
      if (!currentEntry || !user?.username || !currentSlot) return;

      try {
         setIsSubmitting(true);
         setIsGettingLocation(true);
         setQrValue('');
         setErrorMessage(null);

         // Get teacher's current location
         let teacherCoords = null;
         try {
            const coords = await getCurrentPosition();
            teacherCoords = { lat: coords.latitude, lng: coords.longitude };
            toast({ title: 'Location Captured', description: 'Your location has been recorded.' });
         } catch (locErr) {
            setErrorMessage('Unable to get location. Students need your location to verify attendance.');
            toast({ variant: 'destructive', title: 'Location Required', description: 'Unable to get location.' });
            setIsGettingLocation(false);
            setIsSubmitting(false);
            return;
         }
         setIsGettingLocation(false);

         // Get teacher's public IP for IP-based verification
         let teacherIp = '';
         try {
            const ipResp = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResp.json();
            teacherIp = ipData.ip || '';
            console.log('Teacher IP captured:', teacherIp);
         } catch (ipErr) {
            console.warn('Could not get teacher IP:', ipErr);
         }

         const now = new Date();
         const sessionId = uuidv4();
         const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

         const localExpirationDate = new Date(data.expiresAt);
         if (isNaN(localExpirationDate.getTime())) {
            throw new Error('Invalid expiration time. Please select a valid date/time.');
         }
         if (localExpirationDate <= new Date()) {
            throw new Error('Expiration time must be in the future.');
         }

         const qrData = {
            sessionId,
            name: data.name,
            date: data.date,
            time: data.time,
            duration: data.duration,
            generatedAt: now.toISOString(),
            expiresAfter: data.duration,
            expiresAt: localExpirationDate.toISOString(),
            timezone
         };

         // Generate a secret for rotating QR tokens
         const secret = generateSecret();
         setQrSecret(secret);
         sessionIdRef.current = sessionId;

         // Generate the first rotating token
         const qrString = await generateQRToken(sessionId, secret, {
            name: data.name,
            date: data.date,
            time: data.time,
            duration: data.duration,
         });

         // Also keep the static data for the qr_code column (backwards compat)
         const staticQrString = JSON.stringify(qrData);

         // Create session record
         const { data: newSession, error: sessionError } = await supabase
            .from('sessions')
            .insert({
               name: data.name,
               date: data.date,
               time: data.time,
               duration: data.duration,
               qr_code: staticQrString,
               qr_secret: secret,
               expires_at: localExpirationDate.toISOString(),
               timezone,
               is_active: true,
               teacher_lat: teacherCoords.lat,
               teacher_lng: teacherCoords.lng,
               allowed_radius_meters: 150,
               class_id: classInfo?.id || currentEntry.class_id,
               section: classInfo?.section || null,
               teacher_ip: teacherIp || null
            })
            .select()
            .single();

         if (sessionError) throw sessionError;

         setQrValue(qrString);
         setExpiryTime(localExpirationDate);
         setCreatedSessionId(newSession.id);

         toast({
            title: 'Session Started',
            description: `QR Code generated. Expires at ${format(localExpirationDate, 'HH:mm')}.`,
         });
      } catch (error) {
         console.error('Error starting session:', error);
         setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate QR code' });
      } finally {
         setIsSubmitting(false);
         setIsGettingLocation(false);
      }
   };

   const handleManualAttendance = async () => {
      if (createdSessionId) {
         navigate(`/teacher/edit-attendance/${createdSessionId}`);
         return;
      }

      if (!currentEntry || !user?.username || !currentSlot) return;

      try {
         setIsSubmitting(true);
         const now = new Date();
         const todayDate = now.toISOString().split('T')[0];
         const { data: newSession, error: sessionError } = await supabase
            .from('sessions')
            .insert({
               name: `${currentEntry.subject_name} - ${currentSlot.label}`,
               date: todayDate,
               time: currentSlot.start,
               duration: timeToMinutes(currentSlot.end) - timeToMinutes(currentSlot.start),
               is_active: false,
               expires_at: new Date(now.getTime() + 3600000).toISOString(), // 1 hour
               class_id: classInfo?.id || currentEntry.class_id,
               section: classInfo?.section || null
            })
            .select()
            .single();

         if (sessionError) throw sessionError;

         navigate(`/teacher/edit-attendance/${newSession.id}`);
      } catch (error) {
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to start manual session' });
         setIsSubmitting(false);
      }
   };

   if (isLoading) {
      return (
         <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground">Detecting your class...</p>
            </div>
         </div>
      );
   }

   if (!currentEntry || !currentSlot) {
      return (
         <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
            <Button variant="ghost" className="mb-4" onClick={() => navigate('/teacher/dashboard')}>
               <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
            <Card className="border-border/40 shadow-lg">
               <CardContent className="pt-8 pb-8 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                     <Clock className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-lg font-semibold">No Active Class</h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                     {currentSlot
                        ? `Next period starts at ${formatTime12h(currentSlot.start)}`
                        : 'No classes are scheduled for this time'}
                  </p>
               </CardContent>
            </Card>
         </div>
      );
   }

   return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 pb-24">
         {/* Header */}
         <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
         >
            <div>
               <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => navigate('/teacher/dashboard')} className="h-8 w-8 rounded-full border border-border/50">
                     <ArrowLeft className="h-4 w-4" />
                  </Button>
                  QR Code Generator
               </h1>
               <p className="text-muted-foreground mt-1 ml-11">Create attendance QR codes with location tracking</p>
            </div>
            {isGettingLocation && (
               <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                  <MapPin className="h-3 w-3 mr-1 animate-bounce" />
                  Acquiring Location...
               </Badge>
            )}
         </motion.div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Form Card */}
            <motion.div
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.1 }}
               className="space-y-6"
            >
               <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg h-full">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Create New Session
                     </CardTitle>
                     <CardDescription>Fill in the details to generate a QR code</CardDescription>
                  </CardHeader>
                  <CardContent>
                     {errorMessage && (
                        <div className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-md text-sm flex items-start gap-2">
                           <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                           <span>{errorMessage}</span>
                        </div>
                     )}

                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                           <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Session Name</FormLabel>
                                    <FormControl>
                                       <Input disabled className="bg-muted/50 cursor-not-allowed text-foreground" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />

                           <FormField
                              control={form.control}
                              name="date"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Date</FormLabel>
                                    <FormControl>
                                       <Input type="date" disabled className="bg-muted/50 cursor-not-allowed text-foreground" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />

                           <FormField
                              control={form.control}
                              name="time"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Time</FormLabel>
                                    <FormControl>
                                       <Input type="time" disabled className="bg-muted/50 cursor-not-allowed text-foreground" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />

                           <FormField
                              control={form.control}
                              name="duration"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Duration (minutes)</FormLabel>
                                    <FormControl>
                                       <Input type="number" min="1" disabled className="bg-muted/50 cursor-not-allowed text-foreground" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />

                           <FormField
                              control={form.control}
                              name="expiresAt"
                              render={({ field }) => (
                                 <FormItem>
                                    <FormLabel>Expiration Time</FormLabel>
                                    <FormControl>
                                       <Input type="datetime-local" {...field} />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground mt-1 text-blue-600 dark:text-blue-400">Select when the QR code will stop working</p>
                                    <FormMessage />
                                 </FormItem>
                              )}
                           />

                           <Button
                              type="submit"
                              className="w-full text-md font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg mt-4 h-12"
                              disabled={isSubmitting}
                           >
                              {isGettingLocation ? (
                                 <><MapPin className="mr-2 h-5 w-5 animate-bounce" /> Capturing Location...</>
                              ) : isSubmitting ? (
                                 <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                              ) : (
                                 <><QrCodeIcon className="mr-2 h-4 w-4" /> Generate QR Code</>
                              )}
                           </Button>
                        </form>
                     </Form>
                  </CardContent>
               </Card>
            </motion.div>

            {/* Right Column: QR Code Display Card */}
            <motion.div
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.2 }}
            >
               <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg h-full">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2">
                        <QrCodeIcon className="h-5 w-5 text-primary" />
                        QR Code Output
                     </CardTitle>
                     <CardDescription>Your generated QR code will appear here</CardDescription>
                  </CardHeader>
                  <CardContent>
                     {qrValue ? (
                        <motion.div
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           className="flex flex-col items-center space-y-6"
                        >
                           <div className="w-64 h-64 border-4 border-primary/20 p-4 rounded-2xl flex items-center justify-center relative bg-white shadow-2xl">
                              <QRCodeSVG
                                 value={qrValue}
                                 size={240}
                                 level="H"
                                 includeMargin={true}
                              />
                              {(timeLeft && timeLeft !== 'Expired') ? (
                                 <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-3 -right-3 bg-gradient-to-br from-yellow-500 to-orange-500 text-white font-bold rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-lg"
                                 >
                                    <Timer className="h-4 w-4" />
                                    <span className="text-xs">{timeLeft}</span>
                                 </motion.div>
                              ) : timeLeft === 'Expired' && (
                                 <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
                                    <Badge variant="destructive" className="text-lg py-1 px-4 shadow-lg">Expired</Badge>
                                 </div>
                              )}
                           </div>

                           {timeLeft !== 'Expired' && (
                              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center w-full max-w-xs">
                                 <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
                                    <Clock className="h-4 w-4" />
                                    <span>Expires in <span className="font-bold">{timeLeft}</span></span>
                                 </div>
                              </div>
                           )}

                           <p className="text-sm font-medium text-muted-foreground mt-2 max-w-[280px] text-center">
                              Ask students to scan this QR code using their app to mark their attendance.
                           </p>
                        </motion.div>
                     ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                           <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                              <QrCodeIcon className="h-10 w-10 text-muted-foreground" />
                           </div>
                           <p className="text-sm font-medium text-muted-foreground">No QR Code Generated</p>
                           <p className="text-xs text-muted-foreground mt-1">
                              Fill the form and click generate to create a QR code
                           </p>
                        </div>
                     )}
                  </CardContent>
               </Card>
            </motion.div>
         </div>

         {/* Bottom Action Bar — scrolls into view */}
         <div
            className={`fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t z-50 transition-transform duration-300 ${showBottomBar ? 'translate-y-0' : 'translate-y-full'}`}
         >
            <div className="max-w-7xl mx-auto flex justify-end">
               <Button
                  variant="outline"
                  size="lg"
                  className="shadow-lg bg-background border-border/50"
                  onClick={handleManualAttendance}
                  disabled={isSubmitting}
               >
                  <Edit className="h-4 w-4 mr-2" />
                  {createdSessionId ? "View / Edit Attendance List" : "Mark Attendance Manually"}
               </Button>
            </div>
         </div>
      </div>
   );
}
