import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Users,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  ClipboardList,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ClassRow {
  id: string;
  department: string;
  program: string;
  year: string;
  section: string;
  batch: string;
}

interface StudentRow {
  id: string;
  username: string;
  name: string;
}

interface AttendanceRow {
  id?: string;
  username: string;
  status?: string;
  check_in_time?: string | null;
  date?: string;
  session_name?: string;
}

type RowStatus = "present" | "absent" | "unmarked";

function statusForStudent(username: string, attendance: AttendanceRow[]): RowStatus {
  const rows = attendance.filter((a) => a.username === username);
  if (rows.some((r) => String(r.status || "").toLowerCase() === "present")) return "present";
  if (rows.some((r) => String(r.status || "").toLowerCase() === "absent")) return "absent";
  return "unmarked";
}

function firstCheckIn(username: string, attendance: AttendanceRow[]): string {
  const rows = attendance.filter(
    (a) => a.username === username && String(a.status || "").toLowerCase() === "present" && a.check_in_time
  );
  if (rows.length === 0) return "—";
  const sorted = [...rows].sort(
    (a, b) => new Date(a.check_in_time!).getTime() - new Date(b.check_in_time!).getTime()
  );
  try {
    return format(new Date(sorted[0].check_in_time!), "HH:mm");
  } catch {
    return "—";
  }
}

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const fetchFacultyClasses = useCallback(async () => {
    if (!user?.username) {
      setClasses([]);
      setLoadingClasses(false);
      return;
    }
    setLoadingClasses(true);
    try {
      const { data: ttData, error: ttError } = await supabase
        .from("timetables")
        .select("class_id")
        .eq("faculty_id", user.username);

      if (ttError) throw ttError;
      const classIds = Array.from(new Set((ttData || []).map((t: { class_id: string }) => t.class_id).filter(Boolean)));
      if (classIds.length === 0) {
        setClasses([]);
        setSelectedClassId("");
        return;
      }

      const { data: clsData, error: clsError } = await supabase
        .from("classes")
        .select("*")
        .in("id", classIds)
        .order("program", { ascending: true });

      if (clsError) throw clsError;
      const list = (clsData || []) as ClassRow[];
      setClasses(list);
      setSelectedClassId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch (e) {
      console.error(e);
      toast.error("Could not load your classes.");
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [user?.username]);

  const fetchStudentsAndAttendance = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingRecords(true);
    const dateString = format(selectedDate, "yyyy-MM-dd");
    try {
      const { data: studData, error: studError } = await supabase
        .from("users")
        .select("id, username, name")
        .eq("role", "student")
        .eq("department", selectedClass.department)
        .eq("program", selectedClass.program)
        .eq("year", selectedClass.year)
        .eq("section", selectedClass.section)
        .order("username");

      if (studError) throw studError;
      setStudents(studData || []);

      const { data: attData, error: attError } = await supabase
        .from("attendance")
        .select("*")
        .eq("program", selectedClass.program)
        .eq("year", selectedClass.year)
        .eq("section", selectedClass.section)
        .eq("date", dateString);

      if (attError) console.error(attError);
      setAttendance(attData || []);
    } catch (e) {
      console.error(e);
      toast.error("Could not load attendance for this class/date.");
      setStudents([]);
      setAttendance([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    fetchFacultyClasses();
  }, [fetchFacultyClasses]);

  useEffect(() => {
    if (selectedClass) fetchStudentsAndAttendance();
    else {
      setStudents([]);
      setAttendance([]);
    }
  }, [selectedClass, selectedDate, fetchStudentsAndAttendance]);

  const tableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students
      .filter((s) => {
        if (!q) return true;
        return (
          (s.name || "").toLowerCase().includes(q) ||
          (s.username || "").toLowerCase().includes(q)
        );
      })
      .map((student) => {
        const st = statusForStudent(student.username, attendance);
        return {
          student,
          status: st,
          checkIn: st === "present" ? firstCheckIn(student.username, attendance) : "—",
        };
      });
  }, [students, attendance, searchQuery]);

  const totalStudents = students.length;
  const presentToday = useMemo(
    () => students.filter((s) => statusForStudent(s.username, attendance) === "present").length,
    [students, attendance]
  );
  const absentToday = useMemo(() => Math.max(0, totalStudents - presentToday), [totalStudents, presentToday]);

  const handleExport = () => {
    if (!selectedClass || tableRows.length === 0) {
      toast.message("Nothing to export", { description: "Select a class with students first." });
      return;
    }
    const header = ["Roll", "Name", "Status", "Check-in (local)"];
    const lines = tableRows.map((r) => {
      const statusLabel = r.status === "present" ? "Present" : r.status === "absent" ? "Absent" : "Unmarked";
      const safe = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      return [
        safe(r.student.username),
        safe(r.student.name || ""),
        safe(statusLabel),
        safe(r.checkIn),
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faculty-attendance-${selectedClass.program}-${format(selectedDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started");
  };

  const statusBadge = (status: RowStatus) => {
    if (status === "present") {
      return (
        <Badge className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] text-[#047857] font-medium gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Present
        </Badge>
      );
    }
    if (status === "absent") {
      return (
        <Badge className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] font-medium gap-1">
          <XCircle className="h-3.5 w-3.5" />
          Absent
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="rounded-lg border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] font-medium">
        Unmarked
      </Badge>
    );
  };

  return (
    <div className="min-h-full bg-[#F9FAFB] pb-10">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 space-y-2"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#6B7280] shadow-sm">
            <ClipboardList className="h-3.5 w-3.5 text-[#10B981]" />
            Attendance monitor
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#374151]">Faculty dashboard</h1>
          <p className="max-w-2xl text-sm text-[#6B7280]">
            Review roster attendance by class and date. Filters use your assigned timetable classes only.
          </p>
        </motion.div>

        {loadingClasses ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#E5E7EB] bg-white py-20 text-[#6B7280]">
            <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
            <p className="text-sm">Loading your classes…</p>
          </div>
        ) : classes.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white shadow-sm">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF]">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-[#374151]">No classes assigned</h2>
              <p className="mt-2 max-w-md text-sm text-[#6B7280]">
                Your account is not linked to any timetable slots yet. Contact an administrator to assign your
                classes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Card className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#6B7280]">Total students</CardDescription>
                  <CardTitle className="text-2xl font-bold text-[#111827] tabular-nums">
                    {loadingRecords ? "—" : totalStudents}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-[#9CA3AF]">In selected class roster</CardContent>
              </Card>
              <Card className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#6B7280]">Present (selected date)</CardDescription>
                  <CardTitle className="text-2xl font-bold text-[#047857] tabular-nums">
                    {loadingRecords ? "—" : presentToday}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 pt-0 text-xs text-[#059669]">
                  <CheckCircle2 className="h-4 w-4" />
                  At least one present mark that day
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription className="text-[#6B7280]">Not present / unmarked</CardDescription>
                  <CardTitle className="text-2xl font-bold text-[#B91C1C] tabular-nums">
                    {loadingRecords ? "—" : absentToday}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2 pt-0 text-xs text-[#991B1B]">
                  <XCircle className="h-4 w-4" />
                  Roster minus present count
                </CardContent>
              </Card>
            </div>

            <Card className="mb-6 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
              <CardHeader className="border-b border-[#E5E7EB] bg-[#F9FAFB] py-5">
                <CardTitle className="text-base text-[#374151]">Filters</CardTitle>
                <CardDescription className="text-[#6B7280]">
                  Choose class and date. Data loads from the same attendance records used elsewhere in the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-1 md:grid-cols-3 md:items-end">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#374151]">Class / section</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-11 rounded-xl border-[#E5E7EB] bg-white">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.program} {c.year} · Sec {c.section} — {c.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#374151]">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-11 w-full justify-start rounded-xl border-[#E5E7EB] bg-white text-left font-normal text-[#374151]"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4 text-[#10B981]" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => {
                          if (d) setSelectedDate(d);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[#374151]">Search roster</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <Input
                      placeholder="Name or roll…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 rounded-xl border-[#E5E7EB] pl-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
              <CardHeader className="flex flex-col gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB] py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg text-[#374151]">
                    <Users className="h-5 w-5 text-[#10B981]" />
                    Attendance records
                  </CardTitle>
                  <CardDescription className="text-[#6B7280]">
                    {selectedClass
                      ? `${selectedClass.program} ${selectedClass.year} · Section ${selectedClass.section} · ${format(
                          selectedDate,
                          "PPP"
                        )}`
                      : "Select a class"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]"
                  onClick={handleExport}
                  disabled={loadingRecords || tableRows.length === 0}
                >
                  <Download className="mr-2 h-4 w-4 text-[#10B981]" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRecords ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#6B7280]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                    <p className="text-sm">Loading attendance…</p>
                  </div>
                ) : students.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#6B7280]">
                    No students in this class roster.
                  </div>
                ) : tableRows.length === 0 ? (
                  <div className="py-14 text-center text-sm text-[#6B7280]">
                    No rows match your search. Clear the search box to see all students.
                  </div>
                ) : (
                  <div className="max-h-[min(560px,55vh)] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F3F4F6] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                        <tr>
                          <th className="px-5 py-3 text-[#374151]">Roll</th>
                          <th className="px-4 py-3 text-[#374151]">Name</th>
                          <th className="px-4 py-3 text-[#374151]">Status</th>
                          <th className="px-5 py-3 text-right text-[#374151]">Check-in</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {tableRows.map(({ student, status, checkIn }) => (
                          <tr
                            key={student.id}
                            className="bg-white transition-colors hover:bg-[#F9FAFB]/90"
                          >
                            <td className="px-5 py-3 font-medium text-[#111827]">{student.username}</td>
                            <td className="px-4 py-3 text-[#374151]">{student.name}</td>
                            <td className="px-4 py-3">{statusBadge(status)}</td>
                            <td className="px-5 py-3 text-right tabular-nums text-[#6B7280]">{checkIn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
