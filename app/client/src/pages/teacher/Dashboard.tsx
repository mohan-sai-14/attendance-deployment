import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { useToast } from '../../components/ui/toast-hook';
import { 
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Plus,
  QrCode,
  TrendingUp,
  Activity,
  Loader2,
  Eye,
  AlertCircle,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';

interface Session {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  status: 'upcoming' | 'ongoing' | 'completed';
  attendance: number;
  totalStudents: number;
  qrCode?: string;
  created_at: string;
  is_active: boolean;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch sessions from the database
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setIsLoading(true);
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .order('created_at', { ascending: false });

        if (sessionsError) throw sessionsError;

        // Get total students count
        const { count: totalStudentsCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student');

        const now = new Date();
        const formattedSessions = await Promise.all((sessionsData || []).map(async session => {
          const startTime = new Date(`${session.date}T${session.time}`);
          const endTime = new Date(startTime.getTime() + session.duration * 60 * 1000);
          
          let status: 'upcoming' | 'ongoing' | 'completed';
          if (now < startTime) {
            status = 'upcoming';
          } else if (now > endTime || !session.is_active) {
            status = 'completed';
          } else {
            status = 'ongoing';
          }

          // Fetch attendance count for this session (only present and late)
          const { data: attendanceData } = await supabase
            .from('attendance')
            .select('status')
            .eq('session_id', session.id);
          
          const attendanceCount = attendanceData?.filter(
            a => a.status === 'present' || a.status === 'late'
          ).length || 0;

          return {
            ...session,
            status,
            attendance: attendanceCount || 0,
            totalStudents: totalStudentsCount || 0,
            qrCode: session.qr_code
          };
        }));

        setSessions(formattedSessions);
        
        // Set the first active session if any
        const active = formattedSessions.find(s => s.status === 'ongoing');
        if (active) {
          setActiveSession(active);
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load sessions"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [toast]);

  const handleEndSession = async (sessionId: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId);
      
      if (error) throw error;
      
      const updatedSessions = sessions.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'completed' as const }
          : session
      );
      
      setSessions(updatedSessions);
      
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }
      
      toast({
        title: "Success",
        description: "Session ended successfully"
      });
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to end session"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { 
      title: 'Total Sessions', 
      value: sessions.length, 
      icon: Calendar, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10'
    },
    { 
      title: 'Active Sessions', 
      value: sessions.filter(s => s.status === 'ongoing').length, 
      icon: Activity, 
      color: 'text-green-600',
      bgColor: 'bg-green-500/10'
    },
    { 
      title: 'Completed Sessions', 
      value: sessions.filter(s => s.status === 'completed').length, 
      icon: CheckCircle, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10'
    },
    { 
      title: 'Average Attendance', 
      value: sessions.length > 0 
        ? `${Math.round(sessions.reduce((acc, s) => acc + (s.totalStudents > 0 ? (s.attendance / s.totalStudents) * 100 : 0), 0) / sessions.length)}%`
        : '0%', 
      icon: TrendingUp, 
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10'
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1.5" />
            Active
          </Badge>
        );
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'upcoming':
        return <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20">Upcoming</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Teacher Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage your classes and track attendance</p>
        </div>
        <Button 
          onClick={() => navigate('/teacher/qr-generator')}
          className="shadow-lg hover:shadow-xl transition-shadow"
          disabled={isLoading}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="pb-3 relative">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                    <div className={`h-10 w-10 rounded-full ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Session */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Active Session
                  </CardTitle>
                  <CardDescription className="mt-1">Currently running attendance session</CardDescription>
                </div>
                {activeSession && (
                  <Button 
                    variant="destructive"
                    size="sm"
                    onClick={() => handleEndSession(activeSession.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'End Session'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-xl font-semibold">{activeSession.name}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(activeSession.status)}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <span>{format(new Date(activeSession.date), 'MMMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <span>{activeSession.time} ({activeSession.duration} minutes)</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span>{activeSession.attendance} / {activeSession.totalStudents} students present</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Attendance Rate</span>
                          <span className="font-semibold">
                            {Math.round((activeSession.attendance / activeSession.totalStudents) * 100)}%
                          </span>
                        </div>
                        <Progress 
                          value={(activeSession.attendance / activeSession.totalStudents) * 100} 
                          className="h-2"
                        />
                      </div>
                    </div>
                    
                    {activeSession.qrCode && (
                      <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-xl border border-border/40">
                        <QRCodeSVG 
                          value={activeSession.qrCode} 
                          size={180}
                          className="rounded-lg"
                        />
                        <p className="mt-4 text-sm text-muted-foreground text-center">
                          Scan to mark attendance
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No active session</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a new session to begin taking attendance</p>
                  <Button 
                    onClick={() => navigate('/teacher/qr-generator')}
                    className="mt-4"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline"
                className="w-full justify-start border-border/40 hover:bg-primary/5 hover:border-primary/40"
                onClick={() => navigate('/teacher/qr-generator')}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR Code
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button 
                variant="outline"
                className="w-full justify-start border-border/40 hover:bg-primary/5 hover:border-primary/40"
                onClick={() => navigate('/teacher/attendance-history')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Attendance
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button 
                variant="outline"
                className="w-full justify-start border-border/40 hover:bg-primary/5 hover:border-primary/40"
                onClick={() => navigate('/teacher/manual-attendance')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Manual Attendance
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
              <Button 
                variant="outline"
                className="w-full justify-start border-border/40 hover:bg-primary/5 hover:border-primary/40"
                onClick={() => navigate('/teacher/reports')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Reports
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Sessions
            </CardTitle>
            <CardDescription>Your latest attendance sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.slice(0, 5).map((session, index) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/60 hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 cursor-pointer"
                    onClick={() => navigate('/teacher/attendance-history')}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-lg ${
                        session.status === 'ongoing' ? 'bg-green-500/10' :
                        session.status === 'completed' ? 'bg-blue-500/10' :
                        'bg-orange-500/10'
                      } flex items-center justify-center`}>
                        {session.status === 'ongoing' ? (
                          <Activity className="h-6 w-6 text-green-600" />
                        ) : session.status === 'completed' ? (
                          <CheckCircle className="h-6 w-6 text-blue-600" />
                        ) : (
                          <Clock className="h-6 w-6 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{session.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.date), 'MMM d, yyyy')} • {session.time}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(session.status)}
                          <span className="text-xs text-muted-foreground">
                            {session.attendance}/{session.totalStudents} attended
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No sessions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first session to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
