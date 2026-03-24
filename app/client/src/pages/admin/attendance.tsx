import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users, CalendarDays, Clock, ArrowRight, ChevronLeft, AlertCircle, FileText,
  Lock, Edit3, ShieldAlert
} from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/supabase';
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

// Types
interface ClassRow {
  id: string;
  department: string;
  program: string;
  year: string;
  section: string;
  batch: string;
  totalStudents?: number;
}

interface StudentRow {
  id: string;
  username: string; // roll number
  name: string;
}
interface AttendanceRecord {
  id: string;
  username: string;
  status: string;
  check_in_time: string;
  period_number?: number;
  edit_reason?: string;
  session_name?: string;
}

interface TimetableRow {
  id: string;
  subject_name: string;
  faculty_id: string;
  start_time: string;
  end_time: string;
  day_of_week: string;
}

interface PeriodConfig {
  id: string;
  period_number: number;
  start: string;
  end: string;
}

// 8-period config
const PERIODS_CONFIG: PeriodConfig[] = [
  { id: 'p1', period_number: 1, start: '09:00', end: '09:50' },
  { id: 'p2', period_number: 2, start: '09:50', end: '10:40' },
  { id: 'p3', period_number: 3, start: '11:00', end: '11:50' },
  { id: 'p4', period_number: 4, start: '11:50', end: '12:40' },
  { id: 'p5', period_number: 5, start: '13:30', end: '14:20' },
  { id: 'p6', period_number: 6, start: '14:20', end: '15:10' },
  { id: 'p7', period_number: 7, start: '15:30', end: '16:20' },
  { id: 'p8', period_number: 8, start: '16:20', end: '17:10' },
];

export default function Attendance() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [classTimetable, setClassTimetable] = useState<TimetableRow[]>([]);
  const [classAttendance, setClassAttendance] = useState<AttendanceRecord[]>([]);
  const [classStudents, setClassStudents] = useState<StudentRow[]>([]);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);

  // Section 4 state
  const [activePeriod, setActivePeriod] = useState<PeriodConfig | null>(null);
  const [editRecord, setEditRecord] = useState<{ student: StudentRow, currentStatus: string, attId?: string } | null>(null);
  const [editReason, setEditReason] = useState("");
  const [newStatus, setNewStatus] = useState<"present" | "absent">("present");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchPeriodsData();
      fetchClassStudents();
      setActivePeriod(null);
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const { data: classesData, error: classesError } = await supabase.from('classes').select('*').order('program');
      if (classesError) throw classesError;

      const { data: studentsData, error: studentsError } = await supabase
        .from('users')
        .select('id, department, program, year, section')
        .eq('role', 'student');
      if (studentsError) throw studentsError;

      const classesWithCounts = (classesData || []).map(cls => {
        const count = (studentsData || []).filter(s =>
          s.department === cls.department &&
          s.program === cls.program &&
          s.year === cls.year &&
          s.section === cls.section
        ).length;

        return { ...cls, totalStudents: count };
      });

      setClasses(classesWithCounts);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClassStudents = async () => {
    if (!selectedClass) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, name')
        .eq('role', 'student')
        .eq('department', selectedClass.department)
        .eq('program', selectedClass.program)
        .eq('year', selectedClass.year)
        .eq('section', selectedClass.section)
        .order('username');
      if (error) throw error;
      setClassStudents(data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchPeriodsData = async () => {
    if (!selectedClass) return;
    setIsLoadingPeriods(true);
    try {
      const dayOfWeek = format(selectedDate, 'EEEE');
      const dateString = format(selectedDate, 'yyyy-MM-dd');

      const { data: ttData, error: ttError } = await supabase
        .from('timetables')
        .select('*')
        .eq('class_id', selectedClass.id)
        .eq('day_of_week', dayOfWeek);

      if (ttError) throw ttError;
      setClassTimetable(ttData || []);

      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .in('username', classStudents.map(s => s.username))
        .eq('date', dateString);

      if (attError) console.error("Attendance fetch error:", attError);

      setClassAttendance(attData || []);
    } catch (error: any) {
      console.error("Fetch Periods Error", error);
      toast({ title: "Check Console", description: "Could not fetch periods data.", variant: "destructive" });
    } finally {
      setIsLoadingPeriods(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!editRecord || !selectedClass || !activePeriod) return;
    if (!editReason.trim() && editRecord.attId) {
      toast({ title: "Reason Required", description: "You must provide a reason for editing an existing record.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const dateString = format(selectedDate, 'yyyy-MM-dd');

    try {
      const payload: any = {
        username: editRecord.student.username,
        name: editRecord.student.name,
        role: 'student',
        date: dateString,
        status: newStatus,
        check_in_time: new Date().toISOString()
      };

      if (editRecord.attId) {
        const { error } = await supabase.from('attendance').update(payload).eq('id', editRecord.attId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('attendance').insert([payload]);
        if (error) throw error;
      }

      toast({ title: "Success", description: "Attendance record updated." });
      setEditRecord(null);
      setEditReason("");
      fetchPeriodsData(); // Refresh records
    } catch (error: any) {
      toast({ title: "Error Saving", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for 48-hour lock check
  const isPeriodLocked = (period: PeriodConfig) => {
    const startDateTimeStr = `${format(selectedDate, 'yyyy-MM-dd')}T${period.start}:00`;
    const periodStart = new Date(startDateTimeStr);
    const hoursDiff = differenceInHours(new Date(), periodStart);
    return hoursDiff > 48; // Locked if > 48 hours have passed since the start of the period
  };

  // SECTION 1: TODAY'S CLASSES
  if (!selectedClass) {
    const totalInstitutionStudents = classes.reduce((sum, cls) => sum + (cls.totalStudents || 0), 0);

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Attendance Management
            </h1>
            <p className="text-muted-foreground mt-2">Class-wise daily attendance workflow</p>
          </div>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="font-semibold">Total Students: {totalInstitutionStudents}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {classes.map((cls) => (
              <Card key={cls.id} className="border-border/40 shadow-sm bg-background/60 backdrop-blur-sm hover:shadow-md transition-shadow flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{cls.department}</Badge>
                    <Badge variant="secondary" className="text-xs">Batch {cls.batch}</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{cls.program} {cls.year}</CardTitle>
                  <CardDescription>Section {cls.section}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 flex-1">
                  <div className="space-y-3 mt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Total Students</span>
                      <span className="font-medium">{cls.totalStudents || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Periods</span>
                      <span className="font-medium">8 Daily</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 gap-2 flex-col xl:flex-row">
                  <Button className="w-full" variant="default" onClick={() => setSelectedClass(cls)}>
                    <Users className="h-4 w-4 mr-2" /> Class Attendance
                  </Button>
                  <Button className="w-full xl:w-auto" variant="outline" onClick={() => navigate('/admin/timetables')}>
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SECTION 2 & 3 & 4: CLASS ATTENDANCE VIEW & TODAY'S PERIODS & STUDENT LIST
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Section 2: Header and Date Selector */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/60 backdrop-blur-sm p-4 rounded-xl border border-border/40 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (activePeriod) setActivePeriod(null);
            else setSelectedClass(null);
          }} className="shrink-0 bg-muted/50 hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              {selectedClass.program} {selectedClass.year} <span className="text-muted-foreground font-normal">Section {selectedClass.section}</span>
            </h1>
            <p className="text-muted-foreground text-sm">Batch {selectedClass.batch} • {selectedClass.department} Dept</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn("w-[220px] justify-start text-left font-normal bg-background", !selectedDate && "text-muted-foreground")}
              >
                <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { if (d) { setSelectedDate(d); setActivePeriod(null); } }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoadingPeriods ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : !activePeriod ? (
        /* Section 3: Today's Periods */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-lg font-semibold tracking-tight text-foreground/80 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Daily Periods for {format(selectedDate, "EEEE")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PERIODS_CONFIG.map((period) => {
              const ttSlot = classTimetable.find(tt => tt.start_time.startsWith(period.start));
              const periodAttendance = classAttendance.filter(a => a.period_number === period.period_number);

              const isTaken = periodAttendance.length > 0;
              const presentCount = periodAttendance.filter(a => a.status === 'present').length;
              const percentage = isTaken ? Math.round((presentCount / classStudents.length) * 100) : 0; // against total class students

              const isActive = !isTaken && selectedDate.toDateString() === new Date().toDateString();
              const locked = isPeriodLocked(period);

              return (
                <Card key={period.id} className={cn("relative overflow-hidden flex flex-col transition-all", ttSlot ? "hover:border-primary/40 hover:shadow-md" : "opacity-70")}>
                  {locked && isTaken && (
                    <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive" title="Locked (48h passed)">
                      <Lock className="h-3 w-3" />
                    </div>
                  )}
                  <CardHeader className="pb-2 bg-muted/20 border-b border-border/40">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline" className="font-semibold px-2 bg-background">Period {period.period_number}</Badge>
                      <span className="text-xs text-muted-foreground font-medium">{period.start} - {period.end}</span>
                    </div>
                    <CardTitle className="text-base mt-3 line-clamp-1">{ttSlot ? ttSlot.subject_name : "Free Period"}</CardTitle>
                    <CardDescription className="text-xs line-clamp-1">
                      {ttSlot ? `Faculty: ${ttSlot.faculty_id}` : "No assigned faculty"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="py-4 flex-1">
                    {ttSlot ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Status</span>
                          {isTaken ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">Attendance Taken</Badge>
                          ) : isActive ? (
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20">Active Now</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-dashed">Not Taken</Badge>
                          )}
                        </div>
                        {isTaken && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Attendance</span>
                            <span className="font-bold flex items-center gap-1">
                              {presentCount}/{classStudents.length} <span className="text-muted-foreground text-xs font-normal">({percentage}%)</span>
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground/40">
                        <FileText className="h-8 w-8 opacity-20" />
                        <span className="ml-2 text-sm">No Class</span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0 relative z-10 w-full bg-card">
                    <Button
                      className="w-full"
                      variant={isTaken ? "outline" : "default"}
                      disabled={!ttSlot}
                      onClick={() => setActivePeriod(period)}
                    >
                      {isTaken ? "View Details" : "Take Attendance"}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        /* Section 4: Period -> Student Attendance View */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {(() => {
            const ttSlot = classTimetable.find(tt => tt.start_time.startsWith(activePeriod.start));
            const periodAttendance = classAttendance.filter(a => a.period_number === activePeriod.period_number);
            const locked = isPeriodLocked(activePeriod);

            return (
              <Card className="border-border/40 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/10 border-b border-border/40 flex flex-row items-center justify-between py-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">Period {activePeriod.period_number}</Badge>
                      {ttSlot?.subject_name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {format(selectedDate, "PPP")} • {activePeriod.start} - {activePeriod.end} • {ttSlot?.faculty_id}
                    </CardDescription>
                  </div>
                  {locked && (
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 flex items-center gap-1 py-1 px-3">
                      <Lock className="h-3 w-3" /> Locked (48h limit)
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Roll Number</th>
                          <th className="px-6 py-3 font-semibold">Student Name</th>
                          <th className="px-6 py-3 font-semibold text-center">Status</th>
                          <th className="px-6 py-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {classStudents.map((student) => {
                          const record = classAttendance.find(a => 
                            a.username === student.username && 
                            (a.period_number === activePeriod.period_number || 
                             a.session_name?.toLowerCase().includes(ttSlot?.subject_name?.toLowerCase() || ""))
                          );
                          const status = record?.status?.toLowerCase() || "unmarked";

                          return (
                            <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-3 font-medium">{student.username}</td>
                              <td className="px-6 py-3">{student.name}</td>
                              <td className="px-6 py-3 text-center">
                                {status === 'present' ? (
                                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 w-24 justify-center">Present</Badge>
                                ) : status === 'absent' ? (
                                  <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 w-24 justify-center">Absent</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground border-dashed w-24 justify-center bg-muted/20">Unmarked</Badge>
                                )}
                                {record?.edit_reason && (
                                  <span title={`Edited: ${record.edit_reason}`} className="ml-2 inline-flex items-center justify-center bg-blue-500/10 text-blue-600 rounded-full w-5 h-5 text-[10px] font-bold cursor-help">E</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-muted-foreground hover:text-foreground"
                                  disabled={locked}
                                  onClick={() => {
                                    setEditRecord({ student, currentStatus: status, attId: record?.id });
                                    setNewStatus(status === 'present' ? 'absent' : 'present');
                                    setEditReason("");
                                  }}
                                >
                                  {locked ? <Lock className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                                  {locked ? "Locked" : "Edit"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {classStudents.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                              No students found for this class.
                              <Button variant="link" onClick={() => navigate('/admin/students')}>Add students</Button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {/* EDIT MODAL */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Attendance</DialogTitle>
            <DialogDescription>
              Change attendance status for <span className="font-semibold text-foreground">{editRecord?.student.name}</span> ({editRecord?.student.username}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex bg-muted/50 p-3 rounded-lg border border-border/50 items-center justify-between">
              <span className="text-sm font-medium">Current Status</span>
              <Badge variant="outline" className="uppercase font-bold">{editRecord?.currentStatus}</Badge>
            </div>

            <div className="space-y-2">
              <Label>New Status</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={newStatus === 'present' ? "default" : "outline"}
                  className={cn("w-full", newStatus === 'present' ? "bg-green-600 hover:bg-green-700 text-white" : "")}
                  onClick={() => setNewStatus('present')}
                >
                  Present
                </Button>
                <Button
                  variant={newStatus === 'absent' ? "default" : "outline"}
                  className={cn("w-full", newStatus === 'absent' ? "bg-red-600 hover:bg-red-700 text-white" : "")}
                  onClick={() => setNewStatus('absent')}
                >
                  Absent
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between">
                <span>Reason for Change <span className="text-destructive">*</span></span>
              </Label>
              <Textarea
                placeholder="e.g. Student arrived late, Medical leave approved, Mistake in initial entry..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                <ShieldAlert className="h-3 w-3" /> All attendance edits are logged and auditable.
              </p>
            </div>
          </div>

          <DialogFooter className="sm:justify-end">
            <Button variant="ghost" onClick={() => setEditRecord(null)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveAttendance} disabled={isSaving}>
              {isSaving ? "Saving..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
