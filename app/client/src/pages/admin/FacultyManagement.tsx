import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCog, CalendarDays, Plus, Search, Trash2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

interface UserRow {
   id: string;
   username: string;
   name: string;
   email: string;
   department: string;
   status: string;
}

interface TimetableRow {
   id: string;
   class_id: string;
   subject_name: string;
   faculty_id: string;
   day_of_week: string;
   start_time: string;
   end_time: string;
   classes?: {
      program: string;
      year: string;
      section: string;
   };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

export default function FacultyManagement() {
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [searchTerm, setSearchTerm] = useState("");
   const [selectedFaculty, setSelectedFaculty] = useState<UserRow | null>(null);
   const [isAddOpen, setIsAddOpen] = useState(false);
   const [timeSlots] = useState<TimeSlotConfig[]>(DEFAULT_TIME_SLOTS);
   const [formData, setFormData] = useState({
      name: "",
      email: "",
      department: "",
      username: "",
      password: "",
      role: "teacher"
   });

   const { data: facultyList = [], isLoading } = useQuery<UserRow[]>({
      queryKey: ['faculty-list'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'teacher')
            .order('name');

         if (error) throw error;
         return data || [];
      }
   });

   const { data: facultyTimetable = [], isLoading: isLoadingTimetable } = useQuery<TimetableRow[]>({
      queryKey: ['faculty-timetable', selectedFaculty?.username],
      queryFn: async () => {
         if (!selectedFaculty) return [];
         const { data, error } = await supabase
            .from('timetables')
            .select(`*, classes ( program, year, section )`)
            .eq('faculty_id', selectedFaculty.username);
         if (error) throw error;
         return data || [];
      },
      enabled: !!selectedFaculty
   });

   const addMutation = useMutation({
      mutationFn: async (newFaculty: any) => {
         const payload = {
            ...newFaculty,
            status: 'active',
         };

         const { data, error } = await supabase.from('users').insert([payload]).select().single();
         if (error) throw error;
         return data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
         setIsAddOpen(false);
         toast({ title: "Faculty Added", description: `Account has been created successfully.` });
         setFormData({ name: "", email: "", department: "", username: "", password: "", role: "teacher" });
      },
      onError: (error: any) => {
         toast({ variant: "destructive", title: "Error Details", description: error.message });
      }
   });

   const deleteFacultyMutation = useMutation({
      mutationFn: async (username: string) => {
         const { error } = await supabase.from('users').delete().eq('username', username);
         if (error) throw error;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
         if (selectedFaculty?.username === selectedFaculty?.username) setSelectedFaculty(null);
         toast({ title: "Deleted", description: "Faculty record removed." });
      }
   });

   const handleAddSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      addMutation.mutate(formData);
   };

   const filteredFaculty = facultyList.filter(f =>
      f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.username?.toLowerCase().includes(searchTerm.toLowerCase())
   );

   const getSlot = (day: string, startTime: string) => {
      return facultyTimetable.find(t => t.day_of_week === day && t.start_time.startsWith(startTime));
   };

   return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
               <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Faculty Management
               </h1>
               <p className="text-muted-foreground mt-2">Manage teachers and view individual schedules</p>
            </div>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
               <DialogTrigger asChild>
                  <Button className="shrink-0"><Plus className="h-4 w-4 mr-2" /> Add Faculty</Button>
               </DialogTrigger>
               <DialogContent>
                  <DialogHeader>
                     <DialogTitle>Add New Faculty</DialogTitle>
                     <DialogDescription>Create a new teacher account.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label>Username</Label>
                           <Input required placeholder="john_doe" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                           <Label>Password</Label>
                           <Input type="password" required placeholder="••••••••" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label>Full Name</Label>
                        <Input required placeholder="Dr. John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                     </div>
                     <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input type="email" required placeholder="john@university.edu" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label>Department</Label>
                           <Input required placeholder="Computer Science" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                           <Label>Role</Label>
                           <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                              <SelectTrigger>
                                 <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="teacher">Teacher</SelectItem>
                                 <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                     </div>
                     <div className="justify-end flex pt-4">
                        <Button type="submit" disabled={addMutation.isPending} className="w-full">
                           {addMutation.isPending ? "Adding..." : "Add Faculty"}
                        </Button>
                     </div>
                  </form>
               </DialogContent>
            </Dialog>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Faculty List Section */}
            <div className="lg:col-span-1 space-y-4">
               <Card className="border-border/40 shadow-sm bg-background/60 backdrop-blur-sm h-full max-h-[800px] flex flex-col">
                  <CardHeader className="pb-3 shrink-0">
                     <CardTitle className="text-lg flex items-center justify-between">
                        <span className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" /> Directory</span>
                        <Badge variant="secondary">{filteredFaculty.length}</Badge>
                     </CardTitle>
                     <div className="relative mt-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                           placeholder="Search faculty..."
                           className="pl-9"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                        />
                     </div>
                  </CardHeader>
                  <CardContent className="overflow-y-auto flex-1 p-0">
                     <div className="divide-y divide-border/40">
                        {isLoading ? (
                           <div className="p-8 text-center text-muted-foreground animate-pulse">Loading directory...</div>
                        ) : filteredFaculty.length === 0 ? (
                           <div className="p-8 text-center text-muted-foreground">No faculty found.</div>
                        ) : (() => {
                           // Group by department
                           const grouped: Record<string, typeof filteredFaculty> = {};
                           filteredFaculty.forEach(f => {
                              const dept = f.department || 'Unassigned';
                              if (!grouped[dept]) grouped[dept] = [];
                              grouped[dept].push(f);
                           });
                           const sortedDepts = Object.keys(grouped).sort((a, b) => {
                              if (a === 'Unassigned') return 1;
                              if (b === 'Unassigned') return -1;
                              return a.localeCompare(b);
                           });

                           return sortedDepts.map(dept => (
                              <div key={dept}>
                                 <div className="sticky top-0 z-10 px-4 py-2 bg-muted/40 backdrop-blur-sm border-b border-border/30 flex items-center justify-between">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{dept}</span>
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{grouped[dept].length}</Badge>
                                 </div>
                                 {grouped[dept].map(faculty => (
                                    <motion.div
                                       key={faculty.username}
                                       whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                                       onClick={() => setSelectedFaculty(faculty)}
                                       className={`p-4 cursor-pointer transition-colors relative group ${selectedFaculty?.username === faculty.username ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                                    >
                                       <div className="flex justify-between items-start">
                                          <div>
                                             <p className="font-medium">{faculty.name || faculty.username}</p>
                                             <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> {faculty.email || 'No email provided'}
                                             </p>
                                          </div>
                                          <Button
                                             variant="ghost"
                                             size="icon"
                                             className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`Remove ${faculty.name}? This will clear their timetable assignments.`)) {
                                                   deleteFacultyMutation.mutate(faculty.username);
                                                }
                                             }}
                                          >
                                             <Trash2 className="h-4 w-4" />
                                          </Button>
                                       </div>
                                    </motion.div>
                                 ))}
                              </div>
                           ));
                        })()}
                     </div>
                  </CardContent>
               </Card>
            </div>

            {/* Timetable Section */}
            <div className="lg:col-span-2">
               {selectedFaculty ? (
                  <Card className="border-border/40 shadow-sm bg-background/60 backdrop-blur-sm h-full">
                     <CardHeader className="bg-muted/10 border-b border-border/40">
                        <div className="flex items-center justify-between">
                           <div>
                              <CardTitle className="text-xl">Weekly Schedule</CardTitle>
                              <CardDescription>
                                 Teaching schedule for {selectedFaculty.name || selectedFaculty.username} ({selectedFaculty.department})
                              </CardDescription>
                           </div>
                           <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                 {facultyTimetable.length} Classes Assigned
                              </Badge>
                              <CalendarDays className="h-8 w-8 text-primary opacity-20" />
                           </div>
                        </div>
                     </CardHeader>
                     <CardContent className="p-0">
                        {isLoadingTimetable ? (
                           <div className="h-64 flex items-center justify-center p-6">
                              <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                           </div>
                        ) : facultyTimetable.length === 0 ? (
                           <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-xl border border-dashed border-border/50 m-6">
                              <CalendarDays className="h-10 w-10 mb-2 opacity-20" />
                              <p>No classes assigned yet.</p>
                              <p className="text-sm mt-1">Assign classes via the Timetable Management tab.</p>
                           </div>
                        ) : (
                           <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                 <thead className="text-[10px] uppercase bg-muted/50 text-muted-foreground border-b border-t">
                                    <tr>
                                       <th className="px-4 py-3 font-bold border-r w-32">Time / Slot</th>
                                       {DAYS.map(day => (
                                          <th key={day} className="px-4 py-3 font-bold text-center border-r min-w-[140px]">{day}</th>
                                       ))}
                                    </tr>
                                 </thead>
                                 <tbody>
                                    {timeSlots.map((slot) => (
                                       <tr key={slot.id} className={`border-b hover:bg-muted/5 transition-colors ${slot.type === 'break' ? 'bg-muted/5' : ''}`}>
                                          <td className="px-4 py-3 border-r font-medium text-muted-foreground whitespace-nowrap bg-muted/5">
                                             <div className="font-bold text-foreground text-[10px]">{slot.label}</div>
                                             <div className="text-[9px] opacity-70">{slot.start} - {slot.end}</div>
                                          </td>
                                          {DAYS.map(day => {
                                             if (slot.type === 'break') {
                                                return (
                                                   <td key={`${day}-${slot.id}`} className="px-1 py-1 border-r text-center align-middle bg-muted/10">
                                                      <span className="text-[8px] font-bold text-muted-foreground/50 tracking-tighter uppercase">{slot.label}</span>
                                                   </td>
                                                );
                                             }
                                             const assigned = getSlot(day, slot.start);

                                             return (
                                                <td key={`${day}-${slot.id}`} className="px-1 py-1 border-r text-center align-top min-h-[60px]">
                                                   {assigned ? (
                                                      <div className="bg-primary/10 border border-primary/20 rounded p-1.5 h-full flex flex-col justify-center">
                                                         <div className="font-bold text-foreground text-[10px] line-clamp-1">{assigned.subject_name}</div>
                                                         <div className="text-[9px] text-primary mt-0.5 font-medium">
                                                            {assigned.classes ? `${assigned.classes.program} ${assigned.classes.year}-${assigned.classes.section}` : 'N/A'}
                                                         </div>
                                                      </div>
                                                   ) : (
                                                      <div className="text-muted-foreground/20 text-[8px] py-4 italic">Free</div>
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
               ) : (
                  <Card className="border-border/40 shadow-sm bg-background/60 backdrop-blur-sm h-full flex items-center justify-center border-dashed">
                     <div className="text-center p-8 max-w-sm">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                           <UserCog className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Select a Faculty Member</h3>
                        <p className="text-muted-foreground text-sm">
                           Click on a faculty member from the directory to view their weekly teaching schedule.
                        </p>
                     </div>
                  </Card>
               )}
            </div>
         </div>
      </div>
   );
}
