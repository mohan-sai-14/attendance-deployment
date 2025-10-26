import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sidebar } from "../components/teacher/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function TeacherDashboard() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  // Update active tab based on URL
  useEffect(() => {
    const path = location.split("/")[2] || "dashboard";
    setActiveTab(path);
  }, [location]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/teacher/${value}`);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar isOpen={isOpen} setIsOpen={setIsOpen} userRole="teacher" />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isOpen ? 'ml-64' : 'ml-16'}`}>
        <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(!isOpen)}
              className="mr-4"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </Button>
            <h1 className="text-xl font-semibold">Teacher Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {user.name || user.username}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Students
                    </CardTitle>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      className="h-4 w-4 text-muted-foreground"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">
                      Registered students
                    </p>
                  </CardContent>
                </Card>
                {/* Add more dashboard cards here */}
              </div>
            </TabsContent>

            <TabsContent value="attendance">
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Attendance management features will be available here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="students">
              <Card>
                <CardHeader>
                  <CardTitle>Student Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Student management features will be available here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Report generation features will be available here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
