import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Building2, Trash2, Loader2, GraduationCap, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ClassRow {
   id: string;
   department: string;
   program: string;
   year: string;
   section: string;
   batch: string;
   created_at: string;
}

export default function AcademicSetup() {
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const navigate = useNavigate();
   const [isCreateOpen, setIsCreateOpen] = useState(false);
   const [formData, setFormData] = useState({
      department: "",
      program: "",
      year: "",
      section: "",
      batch: "",
   });

   const { data: classes = [], isLoading } = useQuery<ClassRow[]>({
      queryKey: ['classes'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('classes')
            .select('*')
            .order('department', { ascending: true })
            .order('program', { ascending: true })
            .order('year', { ascending: true })
            .order('section', { ascending: true });

         if (error) throw error;
         return data || [];
      }
   });

   const createClassMutation = useMutation({
      mutationFn: async (newClass: Omit<ClassRow, 'id' | 'created_at'>) => {
         const { data, error } = await supabase
            .from('classes')
            .insert([newClass])
            .select()
            .single();

         if (error) throw error;
         return data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['classes'] });
         setIsCreateOpen(false);
         setFormData({ department: "", program: "", year: "", section: "", batch: "" });
         toast({
            title: "Success",
            description: "Class created successfully",
         });
      },
      onError: (error: any) => {
         toast({
            variant: "destructive",
            title: "Error creating class",
            description: error.message,
         });
      }
   });

   const deleteClassMutation = useMutation({
      mutationFn: async (id: string) => {
         const { error } = await supabase.from('classes').delete().eq('id', id);
         if (error) throw error;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['classes'] });
         toast({
            title: "Success",
            description: "Class deleted successfully",
         });
      },
      onError: (error: any) => {
         toast({
            variant: "destructive",
            title: "Error deleting class",
            description: error.message,
         });
      }
   });

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      createClassMutation.mutate(formData);
   };

   return (
      <div className="min-h-full bg-[#F9FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-10">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="space-y-2">
               <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#6B7280] shadow-sm">
                  <GraduationCap className="h-3.5 w-3.5 text-[#10B981]" />
                  Academic structure
               </div>
               <h1 className="text-3xl font-bold tracking-tight text-[#374151]">
                  Academic Setup
               </h1>
               <p className="text-sm text-[#6B7280] max-w-xl">
                  Manage departments, programs, and class groups. Cards link to filtered students for quick roster access.
               </p>
               {!isLoading && classes.length > 0 && (
                  <p className="text-xs text-[#9CA3AF]">
                     <span className="font-medium text-[#6B7280]">{classes.length}</span> class{classes.length !== 1 ? "es" : ""} configured
                  </p>
               )}
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
               <DialogTrigger asChild>
                  <Button className="shrink-0 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white shadow-sm">
                     <Plus className="h-4 w-4 mr-2" />
                     Create Class
                  </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[425px] rounded-2xl border-[#E5E7EB]">
                  <DialogHeader>
                     <DialogTitle className="text-[#374151]">Create New Class</DialogTitle>
                     <DialogDescription>
                        Define a new class grouping for timetables and attendance.
                     </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                     <div className="grid gap-2">
                        <Label htmlFor="department" className="text-sm font-medium text-[#374151]">Department</Label>
                        <Input
                           id="department"
                           placeholder="e.g. Computer Science"
                           className="rounded-xl border-[#E5E7EB]"
                           value={formData.department}
                           onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                           required
                        />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="program" className="text-sm font-medium text-[#374151]">Program</Label>
                        <Input
                           id="program"
                           placeholder="e.g. B.Tech"
                           className="rounded-xl border-[#E5E7EB]"
                           value={formData.program}
                           onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                           required
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label htmlFor="year" className="text-sm font-medium text-[#374151]">Year</Label>
                           <Input
                              id="year"
                              placeholder="e.g. 3 or 3rd"
                              className="rounded-xl border-[#E5E7EB]"
                              value={formData.year}
                              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                              required
                           />
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="section" className="text-sm font-medium text-[#374151]">Section</Label>
                           <Input
                              id="section"
                              placeholder="e.g. A"
                              className="rounded-xl border-[#E5E7EB]"
                              value={formData.section}
                              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                              required
                           />
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="batch" className="text-sm font-medium text-[#374151]">Batch / Academic Year</Label>
                        <Input
                           id="batch"
                           placeholder="e.g. 2023-2027"
                           className="rounded-xl border-[#E5E7EB]"
                           value={formData.batch}
                           onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                           required
                        />
                     </div>
                     <div className="pt-2 flex justify-end gap-2">
                        <Button type="button" variant="outline" className="rounded-xl border-[#E5E7EB]" onClick={() => setIsCreateOpen(false)}>
                           Cancel
                        </Button>
                        <Button type="submit" disabled={createClassMutation.isPending} className="rounded-xl bg-[#10B981] hover:bg-[#059669] text-white">
                           {createClassMutation.isPending ? (
                              <>
                                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                 Creating…
                              </>
                           ) : (
                              "Create Class"
                           )}
                        </Button>
                     </div>
                  </form>
               </DialogContent>
            </Dialog>
         </div>

         <Card className="border border-[#E5E7EB] shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-[#E5E7EB] bg-[#F9FAFB] py-5">
               <CardTitle className="flex items-center gap-2 text-lg text-[#374151]">
                  <Building2 className="h-5 w-5 text-[#10B981]" />
                  Active Classes
               </CardTitle>
               <CardDescription className="text-[#6B7280]">
                  All structured class entities across the institution. Click a card to open students for that class.
               </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
               {isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#6B7280]">
                     <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
                     <p className="text-sm">Loading classes…</p>
                  </div>
               ) : classes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] py-14 px-6 text-center">
                     <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-[#E5E7EB] text-[#9CA3AF]">
                        <Building2 className="h-6 w-6" />
                     </div>
                     <h3 className="text-lg font-semibold text-[#374151]">No classes yet</h3>
                     <p className="text-sm text-[#6B7280] mt-2 max-w-md mx-auto">
                        Create your first class to unlock timetables, attendance, and student assignment.
                     </p>
                     <Button
                        className="mt-6 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white"
                        onClick={() => setIsCreateOpen(true)}
                     >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Class
                     </Button>
                  </div>
               ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                     {classes.map((cls, index) => (
                        <motion.div
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: index * 0.05 }}
                           key={cls.id}
                           onClick={() => {
                              const params = new URLSearchParams({
                                 department: cls.department,
                                 program: cls.program,
                                 year: cls.year,
                                 section: cls.section
                              });
                              navigate(`/admin/students?${params.toString()}`);
                           }}
                           className="group rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:border-[#10B981]/50 hover:shadow-md transition-all duration-200 relative cursor-pointer"
                        >
                           <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-9 w-9 rounded-xl text-[#6B7280] hover:text-red-600 hover:bg-red-50"
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete ${cls.program} ${cls.year} ${cls.section}?`)) {
                                       deleteClassMutation.mutate(cls.id);
                                    }
                                 }}
                              >
                                 <Trash2 className="h-4 w-4" />
                              </Button>
                           </div>
                           <div className="flex flex-col h-full gap-3 pr-8">
                              <div>
                                 <Badge className="mb-3 rounded-lg border border-[#E5E7EB] bg-[#F3F4F6] text-[#374151] font-medium hover:bg-[#F3F4F6]">
                                    Batch {cls.batch}
                                 </Badge>
                                 <h3 className="font-semibold text-lg text-[#111827] leading-tight">
                                    {cls.program}
                                    <span className="block text-sm font-normal text-[#6B7280] mt-1">{cls.department}</span>
                                 </h3>
                                 <p className="text-base font-semibold mt-3 text-[#047857]">
                                    Year {cls.year} · Sec {cls.section}
                                 </p>
                              </div>
                              <div className="mt-auto pt-2 flex items-center gap-1 text-xs font-medium text-[#10B981] opacity-0 group-hover:opacity-100 transition-opacity">
                                 View students
                                 <ArrowRight className="h-3.5 w-3.5" />
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </div>
               )}
            </CardContent>
         </Card>
      </div>
      </div>
   );
}
