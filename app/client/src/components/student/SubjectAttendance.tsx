import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  session_name: string;
  status: 'present' | 'absent' | 'late' | 'od' | 'ml';
  check_in_time: string;
}

interface SubjectAttendanceProps {
  records: AttendanceRecord[];
}

export const SubjectAttendance: React.FC<SubjectAttendanceProps> = ({ records }) => {
  const subjectStats = useMemo(() => {
    const stats: Record<string, { total: number; present: number }> = {};

    records.forEach(record => {
      // Extract subject name from session_name (e.g., "Mathematics - Period 1" -> "Mathematics")
      const subjectName = record.session_name?.split(' - ')[0]?.trim() || 'General';
      
      if (!stats[subjectName]) {
        stats[subjectName] = { total: 0, present: 0 };
      }
      
      stats[subjectName].total += 1;
      // Many statuses count as "present" in these systems
      if (['present', 'late', 'od', 'ml'].includes(record.status?.toLowerCase())) {
        stats[subjectName].present += 1;
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      ...data,
      percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
    })).sort((a, b) => b.percentage - a.percentage);
  }, [records]);

  if (subjectStats.length === 0) return null;

  return (
    <Card className="border border-border/40 shadow-md bg-white">
      <CardHeader className="pb-3 border-b border-border/40">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-[#10B981]" />
          Subject-wise Attendance Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectStats.map((subject) => (
            <div key={subject.name} className="space-y-3 p-4 rounded-xl border border-border/40 bg-[#F9FAFB] hover:bg-white hover:shadow-sm transition-all duration-200">
              <div className="flex justify-between items-start gap-2">
                <span className="font-semibold text-sm text-[#111827] line-clamp-1">{subject.name}</span>
                <Badge 
                  variant={subject.percentage >= 75 ? "default" : "destructive"} 
                  className={`text-[10px] px-2 py-0 font-bold shrink-0 ${
                    subject.percentage >= 75 
                      ? "bg-[#10B981] hover:bg-[#059669]" 
                      : "bg-rose-500 hover:bg-rose-600"
                  }`}
                >
                  {subject.percentage}%
                </Badge>
              </div>
              
              <div className="space-y-1.5">
                <Progress 
                  value={subject.percentage} 
                  className={`h-2 bg-gray-200`}
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-medium tracking-tight">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {subject.present} Present
                  </span>
                  <span>{subject.total} Total</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
