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
   CheckCircle2,
   ShieldAlert,
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
import { LocationPicker } from '@/components/teacher/LocationPicker';

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
   const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number } | null>(null);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   const [qrValue, setQrValue] = useState('');
   const [qrSecret, setQrSecret] = useState('');
   const [qrRotationCount, setQrRotationCount] = useState(0);
   const [expiryTime, setExpiryTime] = useState<Date | null>(null);
   const [timeLeft, setTimeLeft] = useState('');
   const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
   const [showBottomBar, setShowBottomBar] = useState(false);
   const sessionIdRef = useRef<string | null>(null);

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
         if (!user?.id) return;

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
   }, [user?.id, toast, forcedSlotId, form]);

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
      if (!currentEntry || !user?.id || !currentSlot) return;

      try {
         setIsSubmitting(true);
         setIsGettingLocation(true);
         setQrValue('');
         setErrorMessage(null);

         // Get teacher's current location
         let teacherCoords = manualLocation;
         if (!teacherCoords) {
            try {
               const coords = await getCurrentPosition();
               teacherCoords = { lat: coords.latitude, lng: coords.longitude };
               toast({ title: 'Location Captured', description: 'GPS location has been recorded.' });
            } catch (locErr) {
               setErrorMessage('Unable to get automatic location. Please use "Override GPS Location" to drop a pin on the map.');
               toast({ variant: 'destructive', title: 'Location Required', description: 'Unable to get location.' });
               setIsGettingLocation(false);
               setIsSubmitting(false);
               return;
            }
         } else {
            // Using manual override
            console.log('Using manual override coordinates:', teacherCoords);
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
         const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

         const localExpirationDate = new Date(data.expiresAt);
         if (isNaN(localExpirationDate.getTime())) {
            throw new Error('Invalid expiration time. Please select a valid date/time.');
         }
         if (localExpirationDate <= new Date()) {
            throw new Error('Expiration time must be in the future.');
         }

         // Generate a secret for rotating QR tokens
         const secret = generateSecret();
         setQrSecret(secret);

         // First, create the session record WITHOUT the QR token to get the DB-assigned ID
         const { data: newSession, error: sessionError } = await supabase
            .from('sessions')
            .insert({
               name: data.name,
               date: data.date,
               time: data.time,
               duration: data.duration,
               qr_code: '{}', // Placeholder, will be updated below
               qr_secret: secret,
               expires_at: localExpirationDate.toISOString(),
               timezone,
               is_active: true,
               teacher_lat: teacherCoords.lat,
               teacher_lng: teacherCoords.lng,
               allowed_radius_meters: 150,
               class_id: classInfo?.id || currentEntry.class_id,
               section: classInfo?.section || null,
               teacher_ip: teacherIp || null,
               created_by: user.id
            })
            .select()
            .single();

         if (sessionError) throw sessionError;
         
         // Use the database-assigned numeric ID
         const dbSessionId = newSession.id.toString();
         sessionIdRef.current = dbSessionId;

         const qrData = {
            sessionId: dbSessionId,
            name: data.name,
            date: data.date,
            time: data.time,
            duration: data.duration,
            generatedAt: now.toISOString(),
            expiresAfter: data.duration,
            expiresAt: localExpirationDate.toISOString(),
            timezone
         };

         // Generate the true rotating token with the correct ID
         const qrString = await generateQRToken(dbSessionId, secret, {
            name: data.name,
            date: data.date,
            time: data.time,
            duration: data.duration,
         });

         const staticQrString = JSON.stringify(qrData);

         // Update the session in DB with the correct QR JSON
         await supabase
            .from('sessions')
            .update({ qr_code: staticQrString })
            .eq('id', newSession.id);

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

      if (!currentEntry || !user?.id || !currentSlot) return;

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
               section: classInfo?.section || null,
               created_by: user.id
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
      <div className="min-h-screen bg-[#F9FAFB] pb-24">
         <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
            {/* Header */}
            <motion.div
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
            >
               <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/teacher/dashboard')} 
                    className="h-10 w-10 rounded-full border border-[#E5E7EB] bg-white shadow-sm hover:bg-[#F3F4F6] transition-all shrink-0"
                  >
                     <ArrowLeft className="h-4 w-4 text-[#374151]" />
                  </Button>
                  <div>
                     <h1 className="text-3xl font-black text-primary tracking-tight">QR Generator</h1>
                     <p className="text-sm font-medium text-muted-foreground">Standard attendance tracking with location verification</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                  {isGettingLocation && (
                     <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[10px] px-3 py-1.5 rounded-xl uppercase tracking-widest animate-pulse flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        Acquiring GPS...
                     </Badge>
                  )}
                  {manualLocation && (
                     <Badge className="bg-emerald-50 text-[#10B981] border-none font-black text-[10px] px-3 py-1.5 rounded-xl uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        GPS Lock Active
                     </Badge>
                  )}
               </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
               {/* Left Column: Form Card (5 cols) */}
               <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="lg:col-span-5"
               >
                  <Card className="border-none ring-1 ring-[#E5E7EB] bg-white shadow-2xl shadow-black/5 rounded-[2.5rem] overflow-hidden">
                     <CardHeader className="p-8 pb-4">
                        <div className="h-12 w-12 rounded-2xl bg-[#374151]/5 flex items-center justify-center mb-4">
                           <Calendar className="h-6 w-6 text-[#374151]" />
                        </div>
                        <CardTitle className="text-2xl font-black text-[#374151]">Session Setup</CardTitle>
                        <CardDescription className="text-[#9CA3AF] font-bold uppercase text-[10px] tracking-widest mt-1">Configure your attendance window</CardDescription>
                     </CardHeader>
                     <CardContent className="p-8 pt-4">
                        {errorMessage && (
                           <div className="mb-6 bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-start gap-3">
                              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                              <span>{errorMessage}</span>
                           </div>
                        )}

                        <Form {...form}>
                           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                              <FormField
                                 control={form.control}
                                 name="name"
                                 render={({ field }) => (
                                    <FormItem>
                                       <FormLabel className="text-[10px] font-black uppercase text-[#9CA3AF] tracking-[0.2em] ml-1">Class Unit</FormLabel>
                                       <FormControl>
                                          <Input disabled className="h-12 bg-[#F9FAFB] border-none ring-1 ring-[#E5E7EB] rounded-xl font-bold text-[#374151] opacity-70" {...field} />
                                       </FormControl>
                                       <FormMessage />
                                    </FormItem>
                                 )}
                              />

                              <div className="grid grid-cols-2 gap-4">
                                 <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                       <FormItem>
                                          <FormLabel className="text-[10px] font-black uppercase text-[#9CA3AF] tracking-[0.2em] ml-1">Session Date</FormLabel>
                                          <FormControl>
                                             <Input type="date" disabled className="h-12 bg-[#F9FAFB] border-none ring-1 ring-[#E5E7EB] rounded-xl font-bold text-[#374151] opacity-70" {...field} />
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
                                          <FormLabel className="text-[10px] font-black uppercase text-[#9CA3AF] tracking-[0.2em] ml-1">Start Time</FormLabel>
                                          <FormControl>
                                             <Input type="time" disabled className="h-12 bg-[#F9FAFB] border-none ring-1 ring-[#E5E7EB] rounded-xl font-bold text-[#374151] opacity-70" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                       </FormItem>
                                    )}
                                 />
                              </div>

                              <FormField
                                 control={form.control}
                                 name="expiresAt"
                                 render={({ field }) => (
                                    <FormItem>
                                       <FormLabel className="text-[10px] font-black uppercase text-[#9CA3AF] tracking-[0.2em] ml-1">QR Expiration</FormLabel>
                                       <FormControl>
                                          <Input type="datetime-local" className="h-12 bg-white border-none ring-1 ring-[#E5E7EB] rounded-xl font-bold text-[#374151] focus:ring-[#10B981]/50" {...field} />
                                       </FormControl>
                                       <p className="text-[10px] font-bold text-blue-500/80 uppercase tracking-tighter mt-1.5 ml-1 flex items-center gap-1.5">
                                          <Clock className="h-3 w-3" /> QR will stop accepting scans at this time.
                                       </p>
                                       <FormMessage />
                                    </FormItem>
                                 )}
                              />

                              <div className="pt-2">
                                 <LocationPicker 
                                    defaultLocation={manualLocation}
                                    onLocationSelect={(lat, lng) => {
                                      setManualLocation({ lat, lng });
                                      toast({ title: 'Location Overridden', description: 'GPS coordinates locked via map.' });
                                    }}
                                 />
                              </div>

                              <Button
                                 type="submit"
                                 className="w-full h-14 text-sm font-black uppercase tracking-widest bg-[#374151] hover:bg-[#1f2937] text-white rounded-2xl shadow-xl shadow-black/5 mt-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                 disabled={isSubmitting}
                              >
                                 {isGettingLocation ? (
                                    <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Verifying GPS...</>
                                 ) : isSubmitting ? (
                                    <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Preparing...</>
                                 ) : (
                                    <><QrCodeIcon className="mr-3 h-5 w-5" /> Initialize Session</>
                                 )}
                              </Button>
                           </form>
                        </Form>
                     </CardContent>
                  </Card>
               </motion.div>

               {/* Right Column: QR Code Display Card (7 cols) */}
               <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-7"
               >
                  <Card className="border-none ring-1 ring-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.06)] rounded-[3rem] overflow-hidden h-full flex flex-col items-center justify-center relative">
                     {/* Background Pattern */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-[#10B981]/5 rounded-full -mr-32 -mt-32 blur-[80px]" />
                     <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full -ml-32 -mb-32 blur-[80px]" />

                     <CardContent className="p-12 w-full flex flex-col items-center">
                        {qrValue ? (
                           <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex flex-col items-center gap-10 w-full"
                           >
                              <div className="relative group">
                                 {/* Glowing Ring */}
                                 <div className="absolute inset-0 bg-gradient-to-tr from-[#10B981] to-blue-500 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                                 
                                 <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] bg-white border border-[#E5E7EB] p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-center">
                                    <QRCodeSVG
                                       value={qrValue}
                                       size={window.innerWidth < 640 ? 240 : 280}
                                       level="H"
                                       includeMargin={false}
                                       fgColor="currentColor"
                                       className="text-primary"
                                    />
                                    
                                    {/* Rotating Progress Indicator */}
                                    <div className="absolute -inset-2 border-2 border-dashed border-[#E5E7EB] rounded-[3rem] animate-spin-slow opacity-50" />
                                 </div>

                                 {/* Time Badge Overlay */}
                                 <AnimatePresence>
                                    {timeLeft && timeLeft !== 'Expired' && (
                                       <motion.div
                                          initial={{ scale: 0, y: 20 }}
                                          animate={{ scale: 1, y: 0 }}
                                          exit={{ scale: 0, y: 20 }}
                                          className="absolute -top-4 -right-4 bg-[#374151] text-white p-4 rounded-3xl shadow-2xl flex flex-col items-center justify-center min-w-[80px] border-4 border-white"
                                       >
                                          <Timer className="h-4 w-4 mb-1 text-[#10B981]" />
                                          <span className="text-sm font-black tracking-tighter">{timeLeft}</span>
                                          <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Remains</span>
                                       </motion.div>
                                    )}
                                 </AnimatePresence>

                                 {timeLeft === 'Expired' && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-[4px] rounded-[2.5rem] flex flex-col items-center justify-center gap-4 z-10 border-2 border-dashed border-red-200">
                                       <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
                                          <Clock className="h-8 w-8 text-red-500" />
                                       </div>
                                       <div className="text-center">
                                          <p className="text-xl font-black text-red-600 uppercase tracking-widest">Session Expired</p>
                                          <p className="text-xs font-bold text-[#9CA3AF] mt-1">Please generate a new code</p>
                                       </div>
                                    </div>
                                 )}
                              </div>

                              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                                 <div className="bg-[#F9FAFB] p-5 rounded-3xl border border-[#E5E7EB] text-center">
                                    <p className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Status</p>
                                    <div className="flex items-center justify-center gap-2">
                                       <div className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                                       <span className="text-sm font-black text-[#374151] uppercase">Broadcasting</span>
                                    </div>
                                 </div>
                                 <div className="bg-[#F9FAFB] p-5 rounded-3xl border border-[#E5E7EB] text-center">
                                    <p className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest mb-1">Security</p>
                                    <div className="flex items-center justify-center gap-2">
                                       <ShieldAlert className="h-3.5 w-3.5 text-[#374151]" />
                                       <span className="text-sm font-black text-[#374151] uppercase">Enhanced</span>
                                    </div>
                                 </div>
                              </div>

                              <p className="text-center text-xs font-medium text-[#9CA3AF] max-w-xs leading-relaxed">
                                 QR code rotates every <span className="text-[#374151] font-black">5 seconds</span> for maximum security. Students must be within range to scan.
                              </p>
                           </motion.div>
                        ) : (
                           <div className="flex flex-col items-center text-center gap-6 py-20">
                              <div className="relative">
                                 <div className="absolute inset-0 bg-[#E5E7EB] blur-3xl opacity-20 rounded-full" />
                                 <div className="relative h-32 w-32 rounded-[2rem] bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] flex items-center justify-center">
                                    <QrCodeIcon className="h-12 w-12 text-[#D1D5DB]" />
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <h3 className="text-lg font-black text-[#374151]">Ready to Start?</h3>
                                 <p className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest max-w-[240px]">
                                    Complete the form to generate a secure attendance vector
                                 </p>
                              </div>
                           </div>
                        )}
                     </CardContent>
                  </Card>
               </motion.div>
            </div>
         </div>

         {/* Bottom Action Bar — scrolls into view */}
         <AnimatePresence>
            {showBottomBar && (
               <motion.div
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50"
               >
                  <Card className="bg-[#374151] border-none shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-4 text-white overflow-hidden relative">
                     <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 px-4">
                        <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center">
                              <Edit className="h-5 w-5" />
                           </div>
                           <div>
                              <p className="text-xs font-black text-white/50 uppercase tracking-widest">Manual Mode</p>
                              <p className="text-sm font-black">Alternative Attendance</p>
                           </div>
                        </div>
                        
                        <Button
                           className="bg-white text-[#374151] hover:bg-gray-100 font-black rounded-2xl h-14 px-8 shadow-xl transition-all active:scale-95"
                           onClick={handleManualAttendance}
                           disabled={isSubmitting}
                        >
                           {createdSessionId ? "Manage Participants" : "Mark Manually"}
                        </Button>
                     </div>
                  </Card>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
}
