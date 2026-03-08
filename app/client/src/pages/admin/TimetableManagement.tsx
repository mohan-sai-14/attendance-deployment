import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
               <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Timetable Management
               </h1>
               <p className="text-muted-foreground mt-2">Manage weekly class schedules and faculty assignments</p>
            </div>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
               <DialogTrigger asChild>
                  <Button variant="outline">Configure Time Frames</Button>
               </DialogTrigger>
               <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                     <DialogTitle>Configure Daily Slots</DialogTitle>
                     <DialogDescription>Define the periods and breaks for the daily schedule.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                     {timeSlots.map((slot, index) => (
                        <div key={slot.id} className="grid grid-cols-12 gap-2 items-end border-b pb-4">
                           <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Type</Label>
                              <Select
                                 value={slot.type}
                                 onValueChange={(val: 'period' | 'break') => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].type = val;
                                    setTimeSlots(newSlots);
                                 }}
                              >
                                 <SelectTrigger className="h-8">
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="period">Period</SelectItem>
                                    <SelectItem value="break">Break</SelectItem>
                                 </SelectContent>
                              </Select>
                           </div>
                           <div className="col-span-3 space-y-1">
                              <Label className="text-xs">Label</Label>
                              <Input
                                 className="h-8"
                                 value={slot.label}
                                 onChange={(e) => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].label = e.target.value;
                                    setTimeSlots(newSlots);
                                 }}
                              />
                           </div>
                           <div className="col-span-2 space-y-1">
                              <Label className="text-xs">Start</Label>
                              <Input
                                 className="h-8"
                                 value={slot.start}
                                 onChange={(e) => {
                                    const newSlots = [...timeSlots];
                                    newSlots[index].start = e.target.value;
                                    setTimeSlots(newSlots);
                                 }}
                              />
                           </div>
                           <div className="col-span-2 space-y-1">
                              <Label className="text-xs">End</Label>
                              <Input
                                 className="h-8"
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
                                 className="h-8 text-red-500"
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
                        className="w-full border-dashed border-2"
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

         <Card className="border-border/40 shadow-sm bg-background/60 backdrop-blur-sm mb-6">
            <CardContent className="pt-6">
               <div className="flex items-end gap-4">
                  <div className="flex-1 max-w-sm">
                     <Label className="mb-2 block">Select Class</Label>
                     <Popover open={classPopoverOpen} onOpenChange={setClassPopoverOpen}>
                        <PopoverTrigger asChild>
                           <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={classPopoverOpen}
                              className="w-full justify-between"
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
                           <Button className="shrink-0">
                              <Plus className="h-4 w-4 mr-2" /> Assign Slot
                           </Button>
                        </DialogTrigger>
                        <DialogContent>
                           <DialogHeader>
                              <DialogTitle>Assign Subject & Faculty</DialogTitle>
                              <DialogDescription>Add a new entry to this class's timetable.</DialogDescription>
                           </DialogHeader>
                           <form onSubmit={handleAssign} className="space-y-4">
                              <div className="grid gap-2">
                                 <Label>Subject Name</Label>
                                 <Input
                                    required
                                    value={formData.subject_name}
                                    onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                                 />
                              </div>
                              <div className="grid gap-2">
                                 <Label>Faculty</Label>
                                 <Popover open={facultyPopoverOpen} onOpenChange={setFacultyPopoverOpen}>
                                    <PopoverTrigger asChild>
                                       <Button
                                          variant="outline"
                                          role="combobox"
                                          aria-expanded={facultyPopoverOpen}
                                          className="w-full justify-between"
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
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="grid gap-2">
                                    <Label>Day</Label>
                                    <Select required value={formData.day_of_week} onValueChange={(val) => setFormData({ ...formData, day_of_week: val })}>
                                       <SelectTrigger>
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                 </div>
                                 <div className="grid gap-2">
                                    <Label>Time Slot</Label>
                                    <Select required value={`${formData.start_time}-${formData.end_time}`} onValueChange={(val) => {
                                       const [start, end] = val.split('-');
                                       setFormData({ ...formData, start_time: start, end_time: end });
                                    }}>
                                       <SelectTrigger>
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
                              <div className="pt-4 justify-end flex">
                                 <Button type="submit" disabled={assignMutation.isPending}>
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

         {
            selectedClassId && (
               <Card className="border-border/40 shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/30">
                     <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-primary" />
                        Weekly Schedule
                     </CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                           <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b">
                              <tr>
                                 <th className="px-4 py-3 font-semibold border-r w-32">Time / Slot</th>
                                 {DAYS_OF_WEEK.map(day => (
                                    <th key={day} className="px-4 py-3 font-semibold text-center border-r min-w-[150px]">{day}</th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody>
                              {timeSlots.map((slot) => (
                                 <tr key={slot.id} className={`border-b hover:bg-muted/10 transition-colors ${slot.type === 'break' ? 'bg-muted/5' : ''}`}>
                                    <td className="px-4 py-3 border-r font-medium text-muted-foreground whitespace-nowrap">
                                       <div className="font-bold text-foreground text-xs">{slot.label}</div>
                                       <div className="text-[10px]">{slot.start} - {slot.end}</div>
                                    </td>
                                    {DAYS_OF_WEEK.map(day => {
                                       if (slot.type === 'break') {
                                          return (
                                             <td key={`${day}-${slot.id}`} className="px-2 py-2 border-r text-center align-middle bg-muted/20">
                                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{slot.label}</span>
                                             </td>
                                          );
                                       }
                                       const assigned = getSlot(day, slot.start);
                                       const fac = faculty.find(f => f.username === assigned?.faculty_id);

                                       return (
                                          <td key={`${day}-${slot.id}`} className="px-2 py-2 border-r text-center align-top relative group">
                                             {assigned ? (
                                                <div className="bg-primary/10 border border-primary/20 rounded-md p-2 m-1 h-full flex flex-col justify-center relative">
                                                   <span className="font-semibold text-foreground text-xs">{assigned.subject_name}</span>
                                                   <span className="text-muted-foreground text-[11px] mt-1 line-clamp-1">
                                                      {fac?.name || assigned.faculty_id}
                                                   </span>
                                                   <Button
                                                      variant="destructive"
                                                      size="icon"
                                                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity scale-75"
                                                      onClick={() => deleteMutation.mutate(assigned.id)}
                                                   >
                                                      <Trash2 className="h-3 w-3" />
                                                   </Button>
                                                </div>
                                             ) : (
                                                <div className="text-muted-foreground/30 text-[10px] py-4 italic">Free</div>
                                             )}
                                          </td>
                                       )
                                    })}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </CardContent>
               </Card>
            )
         }
      </div >
   );
}
