import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, message, Alert, Typography, Spin, Result } from 'antd';
import { QrcodeOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;

export default function MarkAttendance() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check for session ID in URL (for direct access via QR code)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('sessionId');
    
    if (sessionId) {
      // If session ID is in URL, process it immediately
      processSessionId(sessionId);
    } else {
      setLoading(false);
    }
  }, [location]);

  const processSessionId = async (sessionId: string) => {
    try {
      setLoading(true);
      setStatus('scanning');
      
      // Simulate API call to validate session
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock session data - replace with actual API call
      const mockSession = {
        id: sessionId,
        classId: 'CS101',
        className: 'Introduction to Programming',
        instructor: 'Dr. Smith',
        date: new Date().toLocaleDateString(),
        time: '10:00 AM - 11:30 AM',
        location: 'Building A, Room 101',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes from now
      };
      
      setSession(mockSession);
      setStatus('idle');
    } catch (err) {
      console.error('Error processing session:', err);
      setError('Failed to process attendance session. Please try again.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleScanClick = () => {
    // In a real app, this would open the device camera for QR scanning
    // For demo purposes, we'll simulate a successful scan
    const mockSessionId = `sess_${Date.now()}`;
    processSessionId(mockSessionId);
  };

  const handleMarkAttendance = async () => {
    if (!session || !user) return;
    
    try {
      setLoading(true);
      setStatus('scanning');
      
      // Simulate API call to mark attendance
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock success response
      setStatus('success');
      message.success('Attendance marked successfully!');
      
      // Auto-navigate back to dashboard after 3 seconds
      setTimeout(() => {
        navigate('/student/dashboard');
      }, 3000);
      
    } catch (err) {
      console.error('Error marking attendance:', err);
      setError('Failed to mark attendance. Please try again.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (status === 'success') {
      return (
        <Result
          status="success"
          title="Attendance Marked Successfully!"
          subTitle={`Your attendance for ${session?.className} has been recorded.`}
          extra={[
            <Button 
              type="primary" 
              key="dashboard" 
              onClick={() => navigate('/student/dashboard')}
            >
              Back to Dashboard
            </Button>,
          ]}
        />
      );
    }

    if (status === 'error') {
      return (
        <Result
          status="error"
          title="Failed to Mark Attendance"
          subTitle={error || 'An unknown error occurred.'}
          extra={[
            <Button 
              key="tryAgain" 
              type="primary" 
              onClick={handleMarkAttendance}
              icon={<ReloadOutlined />}
            >
              Try Again
            </Button>,
          ]}
        />
      );
    }

    if (session) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <Title level={3} className="mb-2">{session.className}</Title>
            <Text type="secondary">Instructor: {session.instructor}</Text>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex justify-between">
              <Text type="secondary">Date</Text>
              <Text strong>{session.date}</Text>
            </div>
            <div className="flex justify-between">
              <Text type="secondary">Time</Text>
              <Text strong>{session.time}</Text>
            </div>
            <div className="flex justify-between">
              <Text type="secondary">Location</Text>
              <Text strong>{session.location}</Text>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <Button 
              type="primary" 
              size="large" 
              icon={<CheckCircleOutlined />}
              loading={status === 'scanning'}
              onClick={handleMarkAttendance}
              className="w-full max-w-xs"
            >
              Mark Me Present
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center space-y-6">
        <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-full inline-block">
          <QrcodeOutlined className="text-5xl text-primary" />
        </div>
        
        <Title level={3}>Scan QR Code</Title>
        <Text type="secondary" className="block mb-6">
          Scan the QR code displayed by your instructor to mark your attendance
        </Text>
        
        <Button 
          type="primary" 
          size="large" 
          icon={<QrcodeOutlined />}
          loading={status === 'scanning'}
          onClick={handleScanClick}
          className="w-full max-w-xs"
        >
          Scan QR Code
        </Button>
        
        <div className="pt-4">
          <Text type="secondary" className="block text-sm">
            Or enter the session code provided by your instructor
          </Text>
          <Button 
            type="link" 
            size="small"
            onClick={() => message.info('Manual entry not implemented yet')}
          >
            Enter Code Manually
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card 
        title={
          <div className="text-center">
            <Title level={2} className="mb-0">Mark Attendance</Title>
            <Text type="secondary">
              {session 
                ? 'Verify your attendance details' 
                : 'Scan the QR code to mark your attendance'}
            </Text>
          </div>
        }
        className="shadow-md"
      >
        <div className="p-4">
          {loading ? (
            <div className="text-center py-12">
              <Spin size="large" />
              <div className="mt-4">
                {status === 'scanning' ? 'Processing...' : 'Loading...'}
              </div>
            </div>
          ) : error ? (
            <Alert 
              message="Error" 
              description={error} 
              type="error" 
              showIcon 
              className="mb-6"
            />
          ) : (
            renderContent()
          )}
        </div>
      </Card>
      
      {session && (
        <div className="mt-4 text-center">
          <Button 
            type="link" 
            onClick={() => setSession(null)}
            icon={<CloseCircleOutlined />}
          >
            Cancel and scan a different code
          </Button>
        </div>
      )}
    </div>
  );
}
