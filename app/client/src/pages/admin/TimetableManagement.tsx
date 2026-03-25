import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Check, ChevronsUpDown, Loader2, Table2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface ClassRow {
   id: string;
   department: string;
   program: string;
   year: string;
   section: string;
   batch: string;
}

interface UserRow {
   username: string;
   name: string;
}

interface TimetableRow {
   id: string;
   class_id: string;
   subject_name: string;
   faculty_id: string;
   day_of_week: string;
   start_time: string;
   end_time: string;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface TimeSlotConfig {
   id: string;
   label: string;
   start: string;
   end: string;
   type: 'period' | 'break';
}

const DEFAULT_TIME_SLOTS: TimeSlotConfig[] = [
   { id: 'p1', label: 'Period 1', start: '09:00', end: '09:50', type: 'period' },
   { id: 'p2', label: 'Period 2', start: '09:50', end: '10:40', type: 'period' },
   { id: 'b1', label: 'Short Break', start: '10:40', end: '11:00', type: 'break' },
   { id: 'p3', label: 'Period 3', start: '11:00', end: '11:50', type: 'period' },
   { id: 'p4', label: 'Period 4', start: '11:50', end: '12:40', type: 'period' },
   { id: 'b2', label: 'Lunch Break', start: '12:40', end: '13:30', type: 'break' },
   { id: 'p5', label: 'Period 5', start: '13:30', end: '14:20', type: 'period' },
   { id: 'p6', label: 'Period 6', start: '14:20', end: '15:10', type: 'period' },
   { id: 'b3', label: 'Tea Break', start: '15:10', end: '15:30', type: 'break' },
   { id: 'p7', label: 'Period 7', start: '15:30', end: '16:20', type: 'period' },
   { id: 'p8', label: 'Period 8', start: '16:20', end: '17:10', type: 'period' },
];

export default function TimetableManagement() {
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [selectedClassId, setSelectedClassId] = useState<string>("");
   const [isAssignOpen, setIsAssignOpen] = useState(false);
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
   const [timeSlots, setTimeSlots] = useState<TimeSlotConfig[]>(DEFAULT_TIME_SLOTS);
   const [classPopoverOpen, setClassPopoverOpen] = useState(false);
   const [facultyPopoverOpen, setFacultyPopoverOpen] = useState(false);

   const [formData, setFormData] = useState({
      subject_name: "",
      faculty_id: "",
      day_of_week: "Monday",
      start_time: "09:00",
      end_time: "09:50",
   });

   const { data: classes = [] } = useQuery<ClassRow[]>({
      queryKey: ['classes'],
      queryFn: async () => {
         const { data, error } = await supabase.from('classes').select('*').order('program');
         if (error) throw error;
         return data || [];
      }
   });

   const { data: faculty = [] } = useQuery<UserRow[]>({
      queryKey: ['faculty-teachers'],
      queryFn: async () => {
         const { data, error } = await supabase.from('users').select('username, name').eq('role', 'teacher').order('name');
         if (error) throw error;
         return data || [];
      }
   });

   const { data: timetables = [], isLoading: isLoadingTimetable } = useQuery<TimetableRow[]>({
      queryKey: ['timetables', selectedClassId],
      queryFn: async () => {
         if (!selectedClassId) return [];
         const { data, error } = await supabase.from('timetables').select('*').eq('class_id', selectedClassId);
         if (error) throw error;
         return data || [];
      },
      enabled: !!selectedClassId
   });

   const assignMutation = useMutation({
      mutationFn: async (newEntry: Omit<TimetableRow, 'id'>) => {
         // Logic constraint: Check if faculty is already assigned at this time to ANY class
         const { data: facultyConflict, error: conflictErr } = await supabase
            .from('timetables')
            .select('*')
            .eq('faculty_id', newEntry.faculty_id)
            .eq('day_of_week', newEntry.day_of_week)
            .eq('start_time', `${newEntry.start_time}:00`) // postgres time format padding if needed

         if (conflictErr) throw conflictErr;
         if (facultyConflict && facultyConflict.length > 0) {
            throw new Error("This faculty member is already assigned to a class at this time.");
         }

         // Overlap checking for the SAME class (one subject per slot)
         const { data: classConflict, error: classConflictErr } = await supabase
            .from('timetables')
            .select('*')
            .eq('class_id', newEntry.class_id)
            .eq('day_of_week', newEntry.day_of_week)
            .eq('start_time', `${newEntry.start_time}:00`)

         if (classConflictErr) throw classConflictErr;
         if (classConflict && classConflict.length > 0) {
            throw new Error("This class already has a subject assigned at this time.");
         }

         const { data, error } = await supabase.from('timetables').insert([newEntry]).select().single();
         if (error) throw error;
         return data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['timetables', selectedClassId] });
         setIsAssignOpen(false);
         toast({ title: "Assigned Successfully", description: "Timetable updated." });
      },
      onError: (error: any) => {
         toast({ variant: "destructive", title: "Conflict Error", description: error.message });
      }
   });

   const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
         const { error } = await supabase.from('timetables').delete().eq('id', id);
         if (error) throw error;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['timetables', selectedClassId] });
         toast({ title: "Deleted Successfully", description: "Slot removed." });
      }
   });

   const handleAssign = (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedClassId) return;
      assignMutation.mutate({
         class_id: selectedClassId,
         ...formData
      });
   };

   const getSlot = (day: string, startTime: string) => {
      return timetables.find(t => t.day_of_week === day && t.start_time.startsWith(startTime));
   };

   return (
      <div className="min-h-full bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="space-y-1">
               <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#6B7280] shadow-sm">
                  <Table2 className="h-3.5 w-3.5 text-[#10B981]" />
                  Scheduling
               </div>
               <h1 className="text-3xl font-bold tracking-tight text-[#374151]">
                  Timetable Management
               </h1>
               <p className="text-[#6B7280] mt-1 text-sm sm:text-base max-w-xl">Manage weekly class schedules and faculty assignments.</p>
            </div>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
               <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] shadow-sm shrink-0">
                     Configure Time Frames
                  </Button>
               </DialogTrigger>
               <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border-[#E5E7EB]">
                  <DialogHeader>
                     <DialogTitle className="text-[#374151]">Configure Daily Slots</DialogTitle>
                     <DialogDescription>Define the periods and breaks for the daily schedule.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                     {timeSlots.map((slot, index) => (
                        <div key={slot.id} className="grid grid-cols-12 gap-2 items-end border-b border-[#E5E7EB] pb-4 last:border-0">
                           <div className="col-span-3 space-y-1">
                              <Label className="text-xs text-[#374151] font-medium">Type</Label>
                              <Select
                                 value={slot.type}
                                 onValueChange={(val: 'period' | 'break') => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].type = val;
                                    setTimeSlots(newSlots);
                                 }}
                              >
                                 <SelectTrigger className="h-9 rounded-xl border-[#E5E7EB] bg-white">
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="period">Period</SelectItem>
                                    <SelectItem value="break">Break</SelectItem>
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="col-span-3 space-y-1">
                              <Label className="text-xs text-[#374151] font-medium">Label</Label>
                              <Input
                                 className="h-9 rounded-xl border-[#E5E7EB] bg-white"
                                 value={slot.label}
                                 onChange={(e) => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].label = e.target.value;
                                    setTimeSlots(newSlots);
                                 }}
                              />
                           </div>
                           <div className="col-span-2 space-y-1">
                              <Label className="text-xs text-[#374151] font-medium">Start</Label>
                              <Input
                                 className="h-9 rounded-xl border-[#E5E7EB] bg-white"
                                 value={slot.start}
                                 onChange={(e) => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].start = e.target.value;
                                    setTimeSlots(newSlots);
                                 }}
                              />
                           </div>
                           <div className="col-span-2 space-y-1">
                              <Label className="text-xs text-[#374151] font-medium">End</Label>
                              <Input
                                 className="h-9 rounded-xl border-[#E5E7EB] bg-white"
                                 value={slot.end}
                                 onChange={(e) => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].end = e.target.value;
                                    setTimeSlots(newSlots);
                                 }}
                              />
                           </div>
                           <div className="col-span-2 flex justify-end">
                              <Button
                                 variant="ghost"
                                 size="sm"
                                 className="h-9 rounded-xl text-red-600 hover:bg-red-50"
                                 onClick={() => {
                                    setTimeSlots(timeSlots.filter((_, i) => i !== index));
                                 }}
                              >
                                 <Trash2 className="h-4 w-4" />
                              </Button>
                           </div>
                        </div>
                     ))}
                     <Button
                        variant="ghost"
                        size="sm"
                        className="w-full border-2 border-dashed border-[#E5E7EB] rounded-xl text-[#374151] hover:bg-[#F3F4F6]"
                        onClick={() => {
                           setTimeSlots([...timeSlots, {
                              id: Math.random().toString(36).substr(2, 9),
                              label: 'New Slot',
                              start: '00:00',
                              end: '00:00',
                              type: 'period'
                           }]);
                        }}
                     >
                        <Plus className="h-4 w-4 mr-2" /> Add Slot
                     </Button>
                  </div>
               </DialogContent>
            </Dialog>
         </div>

         <Card className="border border-[#E5E7EB] shadow-sm bg-white mb-6 rounded-2xl overflow-hidden">
            <CardContent className="pt-6 pb-6">
               <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1 max-w-sm w-full">
                     <Label className="mb-2 block text-sm font-medium text-[#374151]">Select Class</Label>
                     <Popover open={classPopoverOpen} onOpenChange={setClassPopoverOpen}>
                        <PopoverTrigger asChild>
                           <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={classPopoverOpen}
                              className="w-full justify-between rounded-xl border-[#E5E7EB] bg-white h-11 text-[#374151] hover:bg-[#F9FAFB]"
                           >
                              {selectedClassId
                                 ? classes.find((cls) => cls.id === selectedClassId)?.program + " " + classes.find((cls) => cls.id === selectedClassId)?.year + " - Sec " + classes.find((cls) => cls.id === selectedClassId)?.section
                                 : "Select class..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                           </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                           <Command>
                              <CommandInput placeholder="Search class..." />
                              <CommandList>
                                 <CommandEmpty>No class found.</CommandEmpty>
                                 <CommandGroup>
                                    {classes.map((cls) => (
                                       <CommandItem
                                          key={cls.id}
                                          value={cls.id}
                                          onSelect={(currentValue) => {
                                             setSelectedClassId(currentValue);
                                             setClassPopoverOpen(false);
                                          }}
                                       >
                                          <Check
                                             className={cn(
                                                "mr-2 h-4 w-4",
                                                selectedClassId === cls.id ? "opacity-100" : "opacity-0"
                                             )}
                                          />
                                          {cls.program} {cls.year} - Sec {cls.section} (Batch {cls.batch})
                                       </CommandItem>
                                    ))}
                                 </CommandGroup>
                              </CommandList>
                           </Command>
                        </PopoverContent>
                     </Popover>
                  </div>

                  {selectedClassId && (
                     <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                        <DialogTrigger asChild>
                           <Button className="shrink-0 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white shadow-sm">
                              <Plus className="h-4 w-4 mr-2" /> Assign Slot
                           </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl border-[#E5E7EB]">
                           <DialogHeader>
                              <DialogTitle className="text-[#374151]">Assign Subject & Faculty</DialogTitle>
                              <DialogDescription>Add a new entry to this class's timetable.</DialogDescription>
                           </DialogHeader>
                           <form onSubmit={handleAssign} className="space-y-4">
                              <div className="grid gap-2">
                                 <Label className="text-[#374151] font-medium">Subject Name</Label>
                                 <Input
                                    required
                                    className="rounded-xl border-[#E5E7EB]"
                                    value={formData.subject_name}
                                    onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                                 />
                              </div>
                              <div className="grid gap-2">
                                 <Label className="text-[#374151] font-medium">Faculty</Label>
                                 <Popover open={facultyPopoverOpen} onOpenChange={setFacultyPopoverOpen}>
                                    <PopoverTrigger asChild>
                                       <Button
                                          variant="outline"
                                          role="combobox"
                                          aria-expanded={facultyPopoverOpen}
                                          className="w-full justify-between rounded-xl border-[#E5E7EB] h-11"
                                       >
                                          {formData.faculty_id
                                             ? faculty.find((f) => f.username === formData.faculty_id)?.name || formData.faculty_id
                                             : "Select faculty..."}
                                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                       </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                       <Command>
                                          <CommandInput placeholder="Search faculty..." />
                                          <CommandList>
                                             <CommandEmpty>No faculty found.</CommandEmpty>
                                             <CommandGroup>
                                                {faculty.map((f) => (
                                                   <CommandItem
                                                      key={f.username}
                                                      value={f.username + " " + (f.name || "")}
                                                      onSelect={() => {
                                                         setFormData({ ...formData, faculty_id: f.username });
                                                         setFacultyPopoverOpen(false);
                                                      }}
                                                   >
                                                      <Check
                                                         className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.faculty_id === f.username ? "opacity-100" : "opacity-0"
                                                         )}
                                                      />
                                                      {f.name || f.username}
                                                   </CommandItem>
                                                ))}
                                             </CommandGroup>
                                          </CommandList>
                                       </Command>
                                    </PopoverContent>
                                 </Popover>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                 <div className="grid gap-2">
                                    <Label className="text-[#374151] font-medium">Day</Label>
                                    <Select required value={formData.day_of_week} onValueChange={(val) => setFormData({ ...formData, day_of_week: val })}>
                                       <SelectTrigger className="rounded-xl border-[#E5E7EB]">
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="grid gap-2">
                                    <Label className="text-[#374151] font-medium">Time Slot</Label>
                                    <Select required value={`${formData.start_time}-${formData.end_time}`} onValueChange={(val) => {
                                       const [start, end] = val.split('-');
                                       setFormData({ ...formData, start_time: start, end_time: end });
                                    }}>
                                       <SelectTrigger className="rounded-xl border-[#E5E7EB]">
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {timeSlots.filter(s => s.type === 'period').map(slot => (
                                             <SelectItem key={slot.id} value={`${slot.start}-${slot.end}`}>
                                                {slot.label}: {slot.start} - {slot.end}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </div>
                              </div>
                              <div className="pt-4 justify-end flex gap-2">
                                 <Button type="submit" disabled={assignMutation.isPending} className="rounded-xl bg-[#10B981] hover:bg-[#059669] text-white">
                                    {assignMutation.isPending ? "Assigning..." : "Assign"}
                                 </Button>
                              </div>
                           </form>
                        </DialogContent>
                     </Dialog>
                  )}
               </div>
            </CardContent>
         </Card>

         {!selectedClassId && (
            <Card className="border border-dashed border-[#E5E7EB] bg-white rounded-2xl shadow-sm mb-6">
               <CardContent className="py-12 px-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#10B981]">
                     <CalendarDays className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#374151]">Choose a class</h3>
                  <p className="mt-2 text-sm text-[#6B7280] max-w-md mx-auto">
                     Select a class above to view and edit its weekly timetable. Use <span className="font-medium text-[#374151]">Assign Slot</span> to add subjects and faculty.
                  </p>
               </CardContent>
            </Card>
         )}

         {
            selectedClassId && (
               <Card className="border border-[#E5E7EB] shadow-sm overflow-hidden rounded-2xl bg-white">
                  <CardHeader className="border-b border-[#E5E7EB] bg-[#F9FAFB] py-4">
                     <CardTitle className="text-lg flex items-center gap-2 text-[#374151]">
                        <CalendarDays className="h-5 w-5 text-[#10B981]" />
                        Weekly Schedule
                     </CardTitle>
                     <CardDescription className="text-[#6B7280]">
                        Hover a cell to remove an assignment. Break rows are read-only.
                     </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                     {isLoadingTimetable ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#6B7280]">
                           <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                           <p className="text-sm">Loading timetable…</p>
                        </div>
                     ) : (
                     <div className="overflow-x-auto max-h-[70vh]">
                        <table className="w-full text-sm text-left">
                           <thead className="text-xs uppercase bg-[#F3F4F6] text-[#6B7280] border-b border-[#E5E7EB] sticky top-0 z-10">
                              <tr>
                                 <th className="px-4 py-3 font-semibold border-r border-[#E5E7EB] w-32 text-[#374151]">Time / Slot</th>
                                 {DAYS_OF_WEEK.map(day => (
                                    <th key={day} className="px-4 py-3 font-semibold text-center border-r border-[#E5E7EB] min-w-[150px] text-[#374151]">{day}</th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody>
                              {timeSlots.map((slot) => (
                                 <tr key={slot.id} className={`border-b border-[#E5E7EB] hover:bg-[#F9FAFB]/80 transition-colors ${slot.type === 'break' ? 'bg-[#F9FAFB]' : ''}`}>
                                    <td className="px-4 py-3 border-r border-[#E5E7EB] font-medium text-[#6B7280] whitespace-nowrap bg-white">
                                       <div className="font-bold text-[#111827] text-xs">{slot.label}</div>
                                       <div className="text-[10px] text-[#9CA3AF]">{slot.start} - {slot.end}</div>
                                    </td>
                                    {DAYS_OF_WEEK.map(day => {
                                       if (slot.type === 'break') {
                                          return (
                                             <td key={`${day}-${slot.id}`} className="px-2 py-2 border-r border-[#E5E7EB] text-center align-middle bg-[#F3F4F6]/80">
                                                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">{slot.label}</span>
                                             </td>
                                          );
                                       }
                                       const assigned = getSlot(day, slot.start);
                                       const fac = faculty.find(f => f.username === assigned?.faculty_id);

                                       return (
                                          <td key={`${day}-${slot.id}`} className="px-2 py-2 border-r border-[#E5E7EB] text-center align-top relative group">
                                             {assigned ? (
                                                <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-2 m-1 h-full flex flex-col justify-center relative shadow-sm">
                                                   <span className="font-semibold text-[#111827] text-xs">{assigned.subject_name}</span>
                                                   <span className="text-[#6B7280] text-[11px] mt-1 line-clamp-1">
                                                      {fac?.name || assigned.faculty_id}
                                                   </span>
                                                   <Button
                                                      variant="destructive"
                                                      size="icon"
                                                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-75 shadow-md"
                                                      onClick={() => deleteMutation.mutate(assigned.id)}
                                                   >
                                                      <Trash2 className="h-3 w-3" />
                                                   </Button>
                                                </div>
                                             ) : (
                                                <div className="text-[#D1D5DB] text-[10px] py-4 italic">Free</div>
                                             )}
                                          </td>
                                       )
                                    })}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                     )}
                  </CardContent>
               </Card>
            )
         }
      </div>
      </div>
   );
}
