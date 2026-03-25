import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
   CheckCircle2,
   XCircle,
   Loader2,
   Lock,
   Unlock,
   ArrowLeft,
   Save,
   Search,
   Timer,
   Clock,
   ShieldAlert,
   Stethoscope,
   FileText,
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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

interface SessionInfo {
   id: string;
   name: string;
   created_at: string;
   created_by: string;
   date: string;
   time: string;
   expires_at: string;
}

export default function EditAttendance() {
   const navigate = useNavigate();
   const { periodId } = useParams<{ periodId: string }>();
   const { user } = useAuth();
   const { toast } = useToast();

   const [session, setSession] = useState<SessionInfo | null>(null);
   const [records, setRecords] = useState<AttendanceRecord[]>([]);
   const [changes, setChanges] = useState<Record<string, string>>({});
   const [searchQuery, setSearchQuery] = useState('');
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [isLocked, setIsLocked] = useState(false);
   const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);

   // Fetch session and attendance data
   const fetchData = async () => {
      if (!periodId) return;

      try {
         setIsLoading(true);

         // Fetch session
         const { data: sessionData, error: sessError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', periodId)
            .single();

         if (sessError) throw sessError;
         
         if (sessionData.created_by !== user.username) {
            toast({
               variant: 'destructive',
               title: 'Access Denied',
               description: 'You can only edit attendance for your own sessions.',
            });
            navigate('/teacher/dashboard');
            return;
         }

         setSession(sessionData);

         // Check lock status — 1 hour from creation
         const createdAt = new Date(sessionData.created_at);
         const deadline = new Date(createdAt.getTime() + 3600000); // 1 hour
         const now = new Date();
         const locked = now > deadline;
         setIsLocked(locked);

         if (!locked) {
            const remaining = Math.ceil((deadline.getTime() - now.getTime()) / 60000);
            setMinutesRemaining(remaining);
         }

         // Fetch existing attendance records
         const { data: attData, error: attError } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', periodId);

         if (attError) throw attError;

         let enrichedRecords: AttendanceRecord[] = [];

         // If session has class_id, fetch all students for this class
         if (sessionData.class_id) {
            const { data: classData } = await supabase
               .from('classes')
               .select('*')
               .eq('id', sessionData.class_id)
               .single();

            if (classData) {
               // Fetch all students matching this class
               const { data: classStudents } = await supabase
                  .from('users')
                  .select('username, name, enroll_no')
                  .eq('role', 'student')
                  .eq('department', classData.department)
                  .eq('program', classData.program)
                  .eq('year', classData.year)
                  .eq('section', sessionData.section || classData.section);

               if (classStudents) {
                  const attMap = (attData || []).reduce((acc, a) => {
                     acc[a.username] = a;
                     return acc;
                  }, {} as Record<string, any>);

                  enrichedRecords = classStudents.map(student => {
                     const existingRecord = attMap[student.username];

                     return {
                        id: existingRecord?.id || `temp-${student.username}`,
                        username: student.username,
                        session_id: periodId as string,
                        check_in_time: existingRecord?.check_in_time || '',
                        status: existingRecord?.status || 'absent',
                        date: existingRecord?.date || sessionData.date,
                        name: student.name,
                        enroll_no: student.enroll_no,
                     };
                  });
               }
            }
         }

         // Fallback if class search found no students or missing class_id
         if (enrichedRecords.length === 0 && attData && attData.length > 0) {
            const usernames = attData.map(a => a.username).filter(Boolean);
            let usersMap: Record<string, { name: string; enroll_no: string }> = {};

            if (usernames.length > 0) {
               const { data: usersData } = await supabase
                  .from('users')
                  .select('username, name, enroll_no')
                  .in('username', usernames);

               usersMap = (usersData || []).reduce((acc, u) => {
                  acc[u.username] = { name: u.name, enroll_no: u.enroll_no };
                  return acc;
               }, {} as Record<string, { name: string; enroll_no: string }>);
            }

            enrichedRecords = attData.map(a => ({
               ...a,
               name: usersMap[a.username]?.name || a.username,
               enroll_no: usersMap[a.username]?.enroll_no,
            }));
         }

         // Sort records by enrollment number
         enrichedRecords.sort((a, b) => {
            const idA = a.enroll_no || a.username || '';
            const idB = b.enroll_no || b.username || '';
            return idA.localeCompare(idB);
         });

         setRecords(enrichedRecords);
      } catch (error) {
         console.error('Error fetching attendance:', error);
         toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load attendance records',
         });
      } finally {
         setIsLoading(false);
      }
   };

   // Fetch layout effect
   useEffect(() => {
      fetchData();
   }, [periodId, toast]);

   // Update remaining time every minute
   useEffect(() => {
      if (isLocked || !session) return;

      const interval = setInterval(() => {
         const createdAt = new Date(session.created_at);
         const deadline = new Date(createdAt.getTime() + 3600000);
         const now = new Date();

         if (now > deadline) {
            setIsLocked(true);
            setMinutesRemaining(null);
            clearInterval(interval);
         } else {
            setMinutesRemaining(Math.ceil((deadline.getTime() - now.getTime()) / 60000));
         }
      }, 60000);

      return () => clearInterval(interval);
   }, [isLocked, session]);

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

   const handleSave = async () => {
      if (isLocked || Object.keys(changes).length === 0) return;

      try {
         setIsSaving(true);

         for (const [recordId, newStatus] of Object.entries(changes)) {
            if (recordId.startsWith('temp-')) {
               const username = recordId.replace('temp-', '');
               const { error } = await supabase
                  .from('attendance')
                  .insert({
                     username,
                     session_id: periodId,
                     status: newStatus,
                     date: session?.date,
                     check_in_time: new Date().toISOString()
                  });
               if (error) throw error;
            } else {
               const { error } = await supabase
                  .from('attendance')
                  .update({
                     status: newStatus,
                  })
                  .eq('id', recordId);

               if (error) throw error;
            }
         }

         setChanges({});

         toast({
            title: 'Changes Saved',
            description: 'Attendance records updated successfully.',
         });

         // Refetch to get real IDs for any temp records
         fetchData();
      } catch (error) {
         console.error('Error saving changes:', error);
         toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to save changes',
         });
      } finally {
         setIsSaving(false);
      }
   };

   const presentCount = records.filter(r => getEffectiveStatus(r) === 'present').length;
   const absentCount = records.filter(r => getEffectiveStatus(r) === 'absent').length;
   const hasChanges = Object.keys(changes).length > 0;

   if (isLoading) {
      return (
         <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="text-sm text-muted-foreground">Loading attendance...</p>
            </div>
         </div>
      );
   }

   if (!session) {
      return (
         <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
            <Button variant="ghost" className="mb-4" onClick={() => navigate('/teacher/dashboard')}>
               <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Card className="border-border/40 shadow-lg">
               <CardContent className="pt-8 pb-8 text-center">
                  <p className="text-muted-foreground">Attendance session not found.</p>
               </CardContent>
            </Card>
         </div>
      );
   }

   return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-8 space-y-5">
         <Button variant="ghost" className="mb-1" onClick={() => navigate('/teacher/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
         </Button>

         {/* Session Info + Lock Status */}
         <Card className="border-border/40 shadow-sm overflow-hidden">
            <div className={`h-1 ${isLocked ? 'bg-gradient-to-r from-red-400 to-orange-400' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`} />
            <CardContent className="pt-5 pb-4">
               <div className="flex items-start justify-between">
                  <div>
                     <h2 className="text-lg font-bold text-foreground">{session.name}</h2>
                     <p className="text-sm text-muted-foreground mt-0.5">
                        {new Date(session.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                     </p>
                  </div>
                  {isLocked ? (
                     <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                     </Badge>
                  ) : (
                     <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                        <Unlock className="h-3 w-3 mr-1" />
                        Editable
                     </Badge>
                  )}
               </div>

               {/* Lock/Edit Status */}
               <div className={`mt-4 p-3 rounded-lg border ${isLocked ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                  <div className="flex items-center gap-2">
                     {isLocked ? (
                        <>
                           <ShieldAlert className="h-4 w-4 text-red-500" />
                           <span className="text-sm text-red-700 dark:text-red-400">
                              Attendance locked. Contact admin for changes.
                           </span>
                        </>
                     ) : (
                        <>
                           <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                           <span className="text-sm text-blue-700 dark:text-blue-400">
                              Editable for {minutesRemaining} more minute{minutesRemaining !== 1 ? 's' : ''}.
                           </span>
                        </>
                     )}
                  </div>
               </div>

               <div className="flex items-center gap-3 mt-3">
                  <Badge variant="outline" className="text-xs">
                     {presentCount} Present
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                     {absentCount} Absent
                  </Badge>
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
            </CardContent>
         </Card>

         {/* Save */}
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
                     <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Saving...
                     </>
                  ) : (
                     <>
                        <Save className="h-5 w-5 mr-2" />
                        Save Changes ({Object.keys(changes).length} modified)
                     </>
                  )}
               </Button>
            </motion.div>
         )}
      </div>
   );
}
