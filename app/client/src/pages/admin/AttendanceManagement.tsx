import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  ClipboardCheck,
  Search,
  Filter,
  Download,
  Eye,
  Calendar as CalendarIcon,
  Users,
  Clock,
  MapPin,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { supabase } from '../integrations/supabase/client';
import { toast } from "@/hooks/use-toast";

interface AttendanceRecord {
  id: string;
  username: string;
  name?: string;
  enroll_no?: string;
  program?: string;
  department?: string;
  year?: string;
  section?: string;
  session_name?: string;
  date: string;
  check_in_time?: string;
  status: string;
  session_id?: string;
}

interface Session {
  id: string;
  name: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  status: string;
  created_at: string;
}

const AttendanceManagement: React.FC = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSession, setSelectedSession] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    fetchAttendanceRecords();
    fetchSessions();
  }, []);

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching attendance:', error);
        toast({
          title: "Error",
          description: "Failed to fetch attendance records",
          variant: "destructive"
        });
        return;
      }

      setAttendanceRecords(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesSearch = record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.session_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSession = selectedSession === 'all' || record.session_id === selectedSession;
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;

    let matchesDate = true;
    if (selectedDate) {
      const recordDate = new Date(record.date);
      matchesDate = recordDate.toDateString() === selectedDate.toDateString();
    }

    return matchesSearch && matchesSession && matchesStatus && matchesDate;
  });

  const handleExport = () => {
    const csvData = filteredRecords.map(record => ({
      Date: record.date,
      Name: record.name || '',
      Username: record.username,
      'Enrollment No': record.enroll_no || '',
      Program: record.program || '',
      Department: record.department || '',
      Year: record.year || '',
      Section: record.section || '',
      'Session Name': record.session_name || '',
      'Check-in Time': record.check_in_time || '',
      Status: record.status
    }));

    const csvString = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate?.toISOString().split('T')[0] || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: attendanceRecords.length,
    present: attendanceRecords.filter(r => r.status === 'present').length,
    absent: attendanceRecords.filter(r => r.status === 'absent').length,
    late: attendanceRecords.filter(r => r.status === 'late').length,
    today: selectedDate ?
      attendanceRecords.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate.toDateString() === selectedDate.toDateString();
      }).length : 0
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">Monitor and manage attendance records</p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedDate ? 'Today' : 'Selected Date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date</label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All Sessions</option>
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>{session.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>
              {filteredRecords.length} records found
              {selectedDate && ` for ${selectedDate.toLocaleDateString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by name, username, or session..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center p-4">Loading...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center p-4 text-gray-500">No records found</div>
              ) : (
                filteredRecords.map((record) => (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        {(record.name || record.username || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{record.name || record.username}</div>
                        <div className="text-sm text-gray-500">
                          {record.session_name} • {record.department} • {record.program}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm font-medium">
                          {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>

                      <Badge className={getStatusBadgeColor(record.status)}>
                        {record.status.toUpperCase()}
                      </Badge>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRecord(record);
                          setShowDetailsModal(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Record Details Modal */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  {(selectedRecord.name || selectedRecord.username || 'U')[0].toUpperCase()}
                </div>
                {selectedRecord.name || selectedRecord.username}
              </CardTitle>
              <CardDescription>Attendance record details</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="academic">Academic Info</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Date</label>
                      <p className="text-sm text-gray-600">
                        {new Date(selectedRecord.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Check-in Time</label>
                      <p className="text-sm text-gray-600">
                        {selectedRecord.check_in_time ?
                          new Date(selectedRecord.check_in_time).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Session</label>
                      <p className="text-sm text-gray-600">{selectedRecord.session_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Badge className={getStatusBadgeColor(selectedRecord.status)}>
                        {selectedRecord.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="academic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Username</label>
                      <p className="text-sm text-gray-600">{selectedRecord.username}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Enrollment No.</label>
                      <p className="text-sm text-gray-600">{selectedRecord.enroll_no || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Program</label>
                      <p className="text-sm text-gray-600">{selectedRecord.program || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Department</label>
                      <p className="text-sm text-gray-600">{selectedRecord.department || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Year</label>
                      <p className="text-sm text-gray-600">{selectedRecord.year || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Section</label>
                      <p className="text-sm text-gray-600">{selectedRecord.section || 'N/A'}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <div className="flex justify-end gap-2 p-6 pt-0">
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement;
