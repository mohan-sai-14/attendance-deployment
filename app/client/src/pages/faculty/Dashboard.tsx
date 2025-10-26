import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, QrCode, Users, Calendar, FileText, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

// Mock data - replace with API calls
const mockSessions = [];
const mockStudents = [];

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState("sessions");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSession, setCurrentSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleStartSession = useCallback(async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      // const response = await fetch('/api/sessions/active', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     subject: 'Sample Subject',
      //     location: 'Sample Location',
      //     duration: 15 // minutes
      // })
      // });
      // const data = await response.json();
      // setCurrentSession(data);
      
      // Mock response
      setCurrentSession({
        id: 'session-123',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=session-123',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        subject: 'Sample Subject',
        location: 'Sample Location'
      });
      
      toast.success("Session started successfully!");
    } catch (error) {
      console.error("Failed to start session:", error);
      toast.error("Failed to start session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleEndSession = useCallback(async () => {
    try {
      setIsLoading(true);
      // TODO: Replace with actual API call
      // await fetch(`/api/sessions/${currentSession.id}`, {
      //   method: 'DELETE'
      // });
      
      setCurrentSession(null);
      toast.success("Session ended successfully!");
    } catch (error) {
      console.error("Failed to end session:", error);
      toast.error("Failed to end session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [currentSession]);

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Faculty Dashboard</h1>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" onClick={() => setActiveTab("sessions")}>
            <Clock className="mr-2 h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="students" onClick={() => setActiveTab("students")}>
            <Users className="mr-2 h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="reports" onClick={() => setActiveTab("reports")}>
            <FileText className="mr-2 h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {!currentSession ? (
            <Card>
              <CardHeader>
                <CardTitle>No Active Session</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center p-12">
                <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-6">
                  Start a new session to take attendance
                </p>
                <Button onClick={handleStartSession} disabled={isLoading}>
                  {isLoading ? "Starting..." : "Start New Session"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Session</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Session will expire at: {new Date(currentSession.expiresAt).toLocaleTimeString()}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-square w-full max-w-xs mx-auto">
                    <img 
                      src={currentSession.qrCode} 
                      alt="Session QR Code" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-2">
                    <p><strong>Subject:</strong> {currentSession.subject}</p>
                    <p><strong>Location:</strong> {currentSession.location}</p>
                    <p><strong>Started:</strong> {new Date().toLocaleTimeString()}</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={handleEndSession}
                    disabled={isLoading}
                  >
                    {isLoading ? "Ending..." : "End Session"}
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Attendance</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Real-time attendance updates
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span>Present: 0</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span>Absent: 0</span>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4 h-64 overflow-y-auto">
                      <p className="text-center text-muted-foreground">
                        No attendance records yet
                      </p>
                      {/* Attendance list will be populated here */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage student records and attendance
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="p-4">
                  <p className="text-center text-muted-foreground">
                    No students found
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <p className="text-sm text-muted-foreground">
                Generate and download attendance reports
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Session Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Download detailed attendance for a specific session
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    Generate
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Date Range Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate report for a specific date range
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    Generate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
