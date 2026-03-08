import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Building2, Trash2 } from "lucide-react";
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
               <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Academic Setup
               </h1>
               <p className="text-muted-foreground mt-2">Manage departments, programs, and classes</p>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
               <DialogTrigger asChild>
                  <Button className="shrink-0 group relative overflow-hidden">
                     <span className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors" />
                     <Plus className="h-4 w-4 mr-2" />
                     Create Class
                  </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                     <DialogTitle>Create New Class</DialogTitle>
                     <DialogDescription>
                        Define a new class grouping for timetables and attendance.
                     </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                     <div className="grid gap-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                           id="department"
                           placeholder="e.g. Computer Science"
                           value={formData.department}
                           onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                           required
                        />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="program">Program</Label>
                        <Input
                           id="program"
                           placeholder="e.g. B.Tech"
                           value={formData.program}
                           onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                           required
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                           <Label htmlFor="year">Year</Label>
                           <Input
                              id="year"
                              placeholder="e.g. 3 or 3rd"
                              value={formData.year}
                              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                              required
                           />
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="section">Section</Label>
                           <Input
                              id="section"
                              placeholder="e.g. A"
                              value={formData.section}
                              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                              required
                           />
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="batch">Batch / Academic Year</Label>
                        <Input
                           id="batch"
                           placeholder="e.g. 2023-2027"
                           value={formData.batch}
                           onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                           required
                        />
                     </div>
                     <div className="pt-4 flex justify-end">
                        <Button type="submit" disabled={createClassMutation.isPending}>
                           {createClassMutation.isPending ? "Creating..." : "Create Class"}
                        </Button>
                     </div>
                  </form>
               </DialogContent>
            </Dialog>
         </div>

         <Card className="border-border/40 shadow-sm bg-background/60 backdrop-blur-sm">
            <CardHeader>
               <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  Active Classes
               </CardTitle>
               <CardDescription>All structured class entities across the institution</CardDescription>
            </CardHeader>
            <CardContent>
               {isLoading ? (
                  <div className="flex justify-center p-8">
                     <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  </div>
               ) : classes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                     No classes created yet. Click "Create Class" to get started.
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
                           className="group rounded-xl border border-border/40 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all duration-300 relative cursor-pointer"
                        >
                           <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                 onClick={() => {
                                    if (confirm(`Are you sure you want to delete ${cls.program} ${cls.year} ${cls.section}?`)) {
                                       deleteClassMutation.mutate(cls.id);
                                    }
                                 }}
                              >
                                 <Trash2 className="h-4 w-4" />
                              </Button>
                           </div>
                           <div className="flex flex-col h-full gap-4">
                              <div>
                                 <Badge variant="secondary" className="mb-2">
                                    {cls.batch}
                                 </Badge>
                                 <h3 className="font-semibold text-lg flex items-baseline gap-2">
                                    {cls.program} <span className="text-sm font-normal text-muted-foreground">{cls.department}</span>
                                 </h3>
                                 <p className="text-2xl font-bold mt-1 text-primary">
                                    Year {cls.year} • Sec {cls.section}
                                 </p>
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </div>
               )}
            </CardContent>
         </Card>
      </div>
   );
}
