import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Calendar as CalendarIcon,
  User,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Clock,
  Database
} from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  user_id?: string;
  username?: string;
  action: string;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'data' | 'system' | 'security' | 'admin';
}

const AuditLogs: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      // For now, we'll use mock data since we don't have an audit_logs table
      // In a real implementation, you'd have an audit_logs table in Supabase
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          user_id: 'user1',
          username: 'admin@example.com',
          action: 'LOGIN',
          table_name: 'auth',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          severity: 'low',
          category: 'authentication',
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        {
          id: '2',
          user_id: 'user2',
          username: 'teacher@example.com',
          action: 'CREATE',
          table_name: 'attendance',
          record_id: 'att1',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          severity: 'medium',
          category: 'data',
          old_values: {},
          new_values: { username: 'student1', status: 'present', session_id: 'session1' }
        },
        {
          id: '3',
          user_id: 'user1',
          username: 'admin@example.com',
          action: 'UPDATE',
          table_name: 'users',
          record_id: 'user3',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
          severity: 'high',
          category: 'admin',
          old_values: { role: 'student' },
          new_values: { role: 'teacher' }
        },
        {
          id: '4',
          user_id: 'user4',
          username: 'student@example.com',
          action: 'DELETE',
          table_name: 'attendance',
          record_id: 'att2',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
          severity: 'critical',
          category: 'security',
          old_values: { username: 'student2', status: 'present' }
        },
        {
          id: '5',
          user_id: 'user2',
          username: 'teacher@example.com',
          action: 'VIEW',
          table_name: 'reports',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
          severity: 'low',
          category: 'data'
        }
      ];

      setAuditLogs(mockLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.table_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;

    let matchesDate = true;
    if (selectedDate) {
      const logDate = new Date(log.timestamp);
      matchesDate = logDate.toDateString() === selectedDate.toDateString();
    }

    return matchesSearch && matchesSeverity && matchesCategory && matchesDate;
  });

  const handleExport = () => {
    const csvData = filteredLogs.map(log => ({
      Timestamp: log.timestamp,
      User: log.username || '',
      Action: log.action,
      Table: log.table_name || '',
      'Record ID': log.record_id || '',
      Severity: log.severity,
      Category: log.category,
      'IP Address': log.ip_address || '',
      'Old Values': log.old_values ? JSON.stringify(log.old_values) : '',
      'New Values': log.new_values ? JSON.stringify(log.new_values) : ''
    }));

    const csvString = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${selectedDate?.toISOString().split('T')[0] || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <Info className="h-4 w-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'authentication': return 'bg-blue-100 text-blue-800';
      case 'data': return 'bg-green-100 text-green-800';
      case 'system': return 'bg-purple-100 text-purple-800';
      case 'security': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    total: auditLogs.length,
    critical: auditLogs.filter(l => l.severity === 'critical').length,
    high: auditLogs.filter(l => l.severity === 'high').length,
    medium: auditLogs.filter(l => l.severity === 'medium').length,
    low: auditLogs.filter(l => l.severity === 'low').length,
    today: selectedDate ?
      auditLogs.filter(l => {
        const logDate = new Date(l.timestamp);
        return logDate.toDateString() === selectedDate.toDateString();
      }).length : 0
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">Monitor system activities and security events</p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.medium}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.low}</div>
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
              <label className="text-sm font-medium mb-2 block">Severity</label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All Categories</option>
                <option value="authentication">Authentication</option>
                <option value="data">Data</option>
                <option value="system">System</option>
                <option value="security">Security</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
            <CardDescription>
              {filteredLogs.length} entries found
              {selectedDate && ` for ${selectedDate.toLocaleDateString()}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-center p-4">Loading...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center p-4 text-gray-500">No audit logs found</div>
              ) : (
                filteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedLog(log);
                      setShowDetailsModal(true);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {getSeverityIcon(log.severity)}
                      <div>
                        <div className="font-medium">{log.action}</div>
                        <div className="text-sm text-gray-500">
                          {log.username} • {log.table_name && `Table: ${log.table_name}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Badge className={getSeverityBadgeColor(log.severity)}>
                          {log.severity.toUpperCase()}
                        </Badge>
                        <Badge className={getCategoryBadgeColor(log.category)}>
                          {log.category}
                        </Badge>
                      </div>

                      <Button size="sm" variant="outline">
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

      {/* Log Details Modal */}
      {showDetailsModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {getSeverityIcon(selectedLog.severity)}
                Audit Log Details
              </CardTitle>
              <CardDescription>Detailed information about this audit entry</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="changes">Changes</TabsTrigger>
                  <TabsTrigger value="context">Context</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Action</label>
                      <p className="text-sm text-gray-600">{selectedLog.action}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Timestamp</label>
                      <p className="text-sm text-gray-600">
                        {new Date(selectedLog.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">User</label>
                      <p className="text-sm text-gray-600">{selectedLog.username || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Table</label>
                      <p className="text-sm text-gray-600">{selectedLog.table_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Severity</label>
                      <Badge className={getSeverityBadgeColor(selectedLog.severity)}>
                        {selectedLog.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Category</label>
                      <Badge className={getCategoryBadgeColor(selectedLog.category)}>
                        {selectedLog.category}
                      </Badge>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="changes" className="space-y-4">
                  {selectedLog.old_values && (
                    <div>
                      <label className="text-sm font-medium">Old Values</label>
                      <pre className="text-xs bg-gray-100 p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(selectedLog.old_values, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedLog.new_values && (
                    <div>
                      <label className="text-sm font-medium">New Values</label>
                      <pre className="text-xs bg-gray-100 p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(selectedLog.new_values, null, 2)}
                      </pre>
                    </div>
                  )}
                  {!selectedLog.old_values && !selectedLog.new_values && (
                    <div className="text-center p-4 text-gray-500">No change data available</div>
                  )}
                </TabsContent>

                <TabsContent value="context" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Record ID</label>
                      <p className="text-sm text-gray-600">{selectedLog.record_id || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">User ID</label>
                      <p className="text-sm text-gray-600">{selectedLog.user_id || 'N/A'}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-medium">IP Address</label>
                      <p className="text-sm text-gray-600">{selectedLog.ip_address || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">User Agent</label>
                      <p className="text-sm text-gray-600 break-all">{selectedLog.user_agent || 'N/A'}</p>
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

export default AuditLogs;
