import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Html5QrcodePlugin } from '../../components/student/html5-qrcode-plugin';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle, XCircle, Loader2, MapPin } from 'lucide-react';
import { getCurrentPosition, verifyLocation, formatDistance } from '../lib/location';


// Simple link component instead of using React Router
const SimpleLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.location.href = to;
  };
  
  return (
    <a href={to} onClick={handleClick} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  );
};


const StudentScannerPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [activeSession, setActiveSession] = useState<any>(null);
  
  // Location verification states
  const [locationVerified, setLocationVerified] = useState(false);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [studentLocation, setStudentLocation] = useState<any>(null);
  
  // Face verification states
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scannedSessionData, setScannedSessionData] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);


  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
        console.log('Face detection models loaded');
      } catch (error) {
        console.error('Failed to load face detection models:', error);
      }
    };
    loadModels();
  }, []);

  // Directly fetch active session
  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        console.log('Scanner: Fetching active session...');
        const { data: sessions, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error('Error fetching active session:', error);
          setActiveSession(null);
          return;
        }
        
        if (sessions && sessions.length > 0) {
          console.log('Active session found:', sessions[0]);
          setActiveSession(sessions[0]);
        } else {
          console.log('No active session found');
          setActiveSession(null);
        }
      } catch (error) {
        console.error('Error fetching active session:', error);
        setActiveSession(null);
      }
    };


    fetchActiveSession();
    
    // Set up interval to periodically check for active sessions
    const intervalId = setInterval(fetchActiveSession, 10000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Function to verify location before scanning
  const handleVerifyLocation = async () => {
    if (!activeSession) {
      toast({
        variant: "destructive",
        title: "No Active Session",
        description: "There is no active session at the moment.",
      });
      return;
    }

    setIsVerifyingLocation(true);
    setErrorMessage('');

    try {
      toast({
        title: "Verifying Location",
        description: "Getting your current location...",
      });

      const studentCoords = await getCurrentPosition();
      console.log("Student location:", studentCoords);

      // Check if teacher location is available
      if (!activeSession.teacher_lat || !activeSession.teacher_lng) {
        console.warn("Teacher location not available for this session");
        toast({
          title: "Location Verification Skipped",
          description: "This session does not have location verification enabled.",
        });
        // Allow scanning without location verification
        setLocationVerified(true);
        setStudentLocation(studentCoords);
        setIsScanning(true);
        setIsVerifyingLocation(false);
        return;
      }

      const teacherCoords = {
        latitude: activeSession.teacher_lat,
        longitude: activeSession.teacher_lng
      };

      const allowedRadius = activeSession.allowed_radius_meters || 150;
      const locationCheck = verifyLocation(studentCoords, teacherCoords, allowedRadius);

      console.log("Location verification:", locationCheck);

      if (!locationCheck.isWithinRange) {
        setIsVerifyingLocation(false);
        toast({
          variant: "destructive",
          title: "Outside Allowed Range",
          description: `You are ${formatDistance(locationCheck.distance)} away from the class location. Please move closer (within ${formatDistance(allowedRadius)}) to mark attendance.`,
          duration: 8000
        });
        setErrorMessage(`You are outside the allowed range. Distance: ${formatDistance(locationCheck.distance)}. Please move closer to the class location.`);
        return;
      }

      toast({
        title: "Location Verified ✓",
        description: `You are ${formatDistance(locationCheck.distance)} from class location. You can now scan the QR code.`,
        duration: 5000
      });

      setLocationVerified(true);
      setStudentLocation(studentCoords);
      setIsScanning(true);
      setIsVerifyingLocation(false);

    } catch (locationError) {
      console.error("Location error:", locationError);
      setIsVerifyingLocation(false);
      toast({
        variant: "destructive",
        title: "Location Required",
        description: locationError instanceof Error ? locationError.message : "Unable to get your location. Please enable location access.",
        duration: 8000
      });
      setErrorMessage("Location access is required to mark attendance. Please enable location permissions and try again.");
    }
  };

  const handleQrCodeSuccess = async (decodedText: string) => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      setIsScanning(false); // Stop scanning immediately after a successful scan
      
      console.log("Raw QR code data:", decodedText);
      
      let sessionData;
      try {
        // Try to parse the QR code data as JSON
        sessionData = JSON.parse(decodedText);
        console.log("Decoded QR code data:", sessionData);
        
        if (!sessionData.sessionId) {
          throw new Error('Invalid QR code format: missing session ID');
        }
        
        // Get current user information from auth context
        if (!user) {
          setErrorMessage('User not authenticated. Please log in again.');
          return;
        }
        
        console.log("QR Session ID found:", sessionData.sessionId);
        console.log("User information:", user);
        
        // Fetch complete user profile from database
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('username', user.username)
          .single();
        
        if (profileError) {
          console.error("Error fetching user profile:", profileError);
          setErrorMessage('Error fetching user profile. Please try again.');
          return;
        }
        
        console.log("Complete user profile:", userProfile);
        
        // Get the active session directly from Supabase
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (sessionsError) {
          console.error("Error fetching active session:", sessionsError);
          setErrorMessage('Error accessing session data. Please try again.');
          return;
        }
        
        if (!sessions || sessions.length === 0) {
          setErrorMessage('No active session found. Please try again later.');
          return;
        }
        
        const activeSessionData = sessions[0];
        console.log("Active session in database:", activeSessionData);
        
        // Format the current date/time
        const now = new Date();
        console.log('Current date/time:', now);
        console.log('Current date/time ISO:', now.toISOString());
        console.log('Current timezone offset:', now.getTimezoneOffset());

        // Format date in YYYY-MM-DD format for PostgreSQL
        const dateString = now.getFullYear() + '-' +
                          String(now.getMonth() + 1).padStart(2, '0') + '-' +
                          String(now.getDate()).padStart(2, '0');

        console.log('Formatted date string:', dateString);
        
        // Format timestamp in database-friendly format (YYYY-MM-DD HH:MM:SS)
        const localTimestamp = dateString + ' ' +
                             String(now.getHours()).padStart(2, '0') + ':' +
                             String(now.getMinutes()).padStart(2, '0') + ':' +
                             String(now.getSeconds()).padStart(2, '0');
        
        console.log("Using timestamp:", localTimestamp);
        console.log("Using date:", dateString);
        
        // Check if attendance has already been recorded
        console.log("Checking for existing attendance with username:", user.username, "and session_id:", activeSessionData.id);
        
        const { data: existingAttendance, error: checkError } = await supabase
          .from('attendance')
          .select('*')
          .eq('username', user.username)
          .eq('session_id', activeSessionData.id);
        
        console.log("Existing attendance check result:", existingAttendance);
        console.log("Check error:", checkError);
          
        if (checkError) {
          console.error("Error checking attendance:", checkError);
        }
        
        if (existingAttendance && existingAttendance.length > 0) {
          console.log("Attendance already recorded for this session");
          setSuccess(true);
          setErrorMessage(''); // Clear any previous error messages
          setIsScanning(false);
          
          // Show specific message for already recorded attendance
          toast({
            title: "Already Recorded",
            description: "Your attendance for this session was already recorded.",
            duration: 5000
          });
          
          setTimeout(() => {
            window.location.href = '/student/dashboard';
          }, 2000);
          
          return;
        }
        
        console.log("No existing attendance found, proceeding to face verification...");
        
        // Store session data and user profile for face verification
        setScannedSessionData({
          sessionData: activeSessionData,
          dateString,
          localTimestamp,
          userProfile,
          studentLocation: studentLocation ? {
            lat: studentLocation.latitude,
            lng: studentLocation.longitude
          } : null
        });
        setUserProfile(userProfile);
        
        // Show face verification UI
        setShowFaceVerification(true);
        setIsLoading(false);
        
        toast({
          title: "QR Code Verified",
          description: "Please complete face verification to mark attendance.",
          duration: 3000
        });
        
      } catch (e) {
        console.error("QR code parse error:", e);
        setErrorMessage('Invalid QR code format. Please try again or use the code entry method.');
        return;
      }
    } catch (error: any) {
      console.error('Error processing QR code:', error);
      setErrorMessage('Failed to process QR code. Please try again or use the code entry option.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleScanAgain = () => {
    setIsScanning(true);
    setErrorMessage('');
    setSuccess(false);
  };

  // Face verification functions
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
              toast({
                variant: "destructive",
                title: "Camera Error",
                description: "Failed to start video playback."
              });
            });
          }
        };
      }
    } catch (error) {
      console.error('Camera error:', error);
      setIsCameraActive(false);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions."
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const verifyFaceAndMarkAttendance = async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !scannedSessionData || !user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Face verification not ready. Please try again."
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Capture face and generate embedding
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Canvas context not available');

      // Detect face
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        toast({
          variant: "destructive",
          title: "No Face Detected",
          description: "Please position your face in front of the camera."
        });
        setIsVerifying(false);
        return;
      }

      if (detections.length > 1) {
        toast({
          variant: "destructive",
          title: "Multiple Faces",
          description: "Please ensure only one person is visible."
        });
        setIsVerifying(false);
        return;
      }

      const face = detections[0];
      const capturedEmbedding = Array.from(face.descriptor);

      // Get stored face embedding from user profile
      const storedEmbedding = userProfile?.face_embeddings;

      if (!storedEmbedding || !Array.isArray(storedEmbedding)) {
        toast({
          variant: "destructive",
          title: "Face Not Enrolled",
          description: "Please complete face enrollment with admin first."
        });
        setIsVerifying(false);
        return;
      }

      // Calculate similarity
      const distance = faceapi.euclideanDistance(capturedEmbedding, storedEmbedding);
      const similarity = 1 - distance;
      const threshold = 0.6; // Adjust based on testing

      console.log('Face verification - Distance:', distance, 'Similarity:', similarity);

      if (similarity < threshold) {
        toast({
          variant: "destructive",
          title: "Face Verification Failed",
          description: "Face does not match. Please try again."
        });
        setIsVerifying(false);
        return;
      }

      // Face verified! Now mark attendance
      const { sessionData, dateString, localTimestamp, studentLocation } = scannedSessionData;
      
      // Calculate distance if both locations are available
      let distanceFromTeacher = null;
      let locationVerified = false;
      
      if (studentLocation && sessionData.teacher_lat && sessionData.teacher_lng) {
        const teacherCoords = {
          latitude: sessionData.teacher_lat,
          longitude: sessionData.teacher_lng
        };
        const studentCoords = {
          latitude: studentLocation.lat,
          longitude: studentLocation.lng
        };
        const locationCheck = verifyLocation(studentCoords, teacherCoords, sessionData.allowed_radius_meters || 150);
        distanceFromTeacher = locationCheck.distance;
        locationVerified = locationCheck.isWithinRange;
      }
      
      const attendanceRecord = {
        username: user.username,
        enroll_no: userProfile.roll_no || user.username,
        registered_no: userProfile.registered_no || userProfile.roll_no || user.username,
        program: userProfile.program || '',
        department: userProfile.department || '',
        section: userProfile.section || '',
        year: userProfile.year || '',
        session_id: sessionData.id,
        check_in_time: localTimestamp,
        date: dateString,
        status: 'present',
        name: userProfile.name || user.name || 'Student',
        session_name: sessionData.name,
        face_verified: true,
        verification_confidence: similarity,
        student_lat: studentLocation?.lat,
        student_lng: studentLocation?.lng,
        distance_from_teacher_meters: distanceFromTeacher,
        location_verified: locationVerified
      };

      const { error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceRecord);

      if (insertError) {
        console.error("Error recording attendance:", insertError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to record attendance. Please try again."
        });
        setIsVerifying(false);
        return;
      }

      // Success!
      stopCamera();
      setSuccess(true);
      setShowFaceVerification(false);
      
      toast({
        title: "Success!",
        description: `Attendance marked successfully! (${Math.round(similarity * 100)}% match)`,
        duration: 5000
      });

      setTimeout(() => {
        window.location.href = '/student/dashboard';
      }, 2000);

    } catch (error) {
      console.error('Face verification error:', error);
      toast({
        variant: "destructive",
        title: "Verification Error",
        description: "An error occurred during face verification."
      });
      setIsVerifying(false);
    }
  };

  const cancelFaceVerification = () => {
    stopCamera();
    setShowFaceVerification(false);
    setScannedSessionData(null);
    setIsScanning(true);
  };

  // Session code fetching
  const { data: sessionCode } = useQuery({
    queryKey: ['sessionCode', activeSession?.id],
    queryFn: async () => {
      if (!activeSession?.id) return null;
      try {
        const response = await axios.get(`/api/sessions/code/${activeSession.id}`);
        return response.data.attendanceCode;
      } catch (error) {
        console.error('Error fetching session code:', error);
        return null;
      }
    },
    enabled: !!activeSession?.id,
    retry: false,
  });


  if (activeSession === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 p-5 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">No Active Session Found</h2>
          <p className="text-gray-600 mb-4">
            There is currently no active attendance session. Please try again when a session is active.
          </p>
          <Button onClick={() => window.location.href = '/student'}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4">
      {!activeSession ? (
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-red-500 mb-4">No Active Session Found</h2>
          <p className="text-gray-600 mb-4">
            There is currently no active attendance session. Please try again when a session is active.
          </p>
          <Button onClick={() => window.location.href = '/student'}>
            Return to Dashboard
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">
            Record Your Attendance
          </h2>
          
          <Card className="shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{activeSession.name}</h3>
                  <p className="text-sm text-gray-600">
                    {activeSession.date} • {activeSession.time}
                  </p>
                </div>
                
                <Badge 
                  variant="outline" 
                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                >
                  Active Session
                </Badge>
              </div>


              <div className="w-full pt-4">
                  {showFaceVerification ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">Face Verification Required</h3>
                        <p className="text-sm text-blue-700">
                          QR code verified! Please complete face verification to mark your attendance.
                        </p>
                      </div>

                      <div className="relative w-full max-w-md mx-auto">
                        <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                          {isCameraActive ? (
                            <>
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-48 h-48 border-2 border-blue-500 rounded-full opacity-50"></div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Camera className="h-12 w-12 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                      </div>

                      <div className="flex flex-col space-y-2">
                        {!isCameraActive ? (
                          <Button onClick={startCamera} disabled={!modelsLoaded} className="w-full">
                            <Camera className="h-4 w-4 mr-2" />
                            {modelsLoaded ? 'Start Camera' : 'Loading models...'}
                          </Button>
                        ) : (
                          <Button 
                            onClick={verifyFaceAndMarkAttendance} 
                            disabled={isVerifying}
                            className="w-full"
                          >
                            {isVerifying ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Verifying...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Verify Face & Mark Attendance
                              </>
                            )}
                          </Button>
                        )}
                        <Button variant="outline" onClick={cancelFaceVerification} className="w-full">
                          Cancel
                        </Button>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600">
                          <strong>Instructions:</strong> Position your face within the circle and click "Verify Face" when ready.
                        </p>
                      </div>
                    </div>
                  ) : success ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center space-y-6">
                      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-10 w-10 text-green-600" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M5 13l4 4L19 7" 
                          />
                        </svg>
                      </div>
                      
                      <div>
                        <h3 className="text-xl font-bold text-green-600 mb-2">Attendance Recorded!</h3>
                        <p className="text-gray-600 mb-4">
                          Your attendance has been successfully recorded for this session.
                        </p>
                      </div>
                      
                      <div className="space-x-4">
                        <Button onClick={() => window.location.href = '/student/dashboard'}>
                          Go to Dashboard
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setSuccess(false);
                          setIsScanning(true);
                          setErrorMessage('');
                        }}>
                          Scan Again
                        </Button>
                      </div>
                    </div>
                  ) : isLoading ? (
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-primary font-medium">Verifying QR code...</p>
                    </div>
                  ) : !locationVerified ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                        <div className="flex justify-center mb-4">
                          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                            <MapPin className="h-8 w-8 text-blue-600" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-blue-900 mb-2 text-lg">Location Verification Required</h3>
                        <p className="text-sm text-blue-700 mb-6">
                          Before scanning the QR code, we need to verify that you are within the allowed range of the class location.
                        </p>
                        <Button 
                          onClick={handleVerifyLocation} 
                          disabled={isVerifyingLocation}
                          className="w-full max-w-xs mx-auto"
                          size="lg"
                        >
                          {isVerifyingLocation ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Verifying Location...
                            </>
                          ) : (
                            <>
                              <MapPin className="h-5 w-5 mr-2" />
                              Verify My Location
                            </>
                          )}
                        </Button>
                      </div>

                      {errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                          {errorMessage}
                        </div>
                      )}

                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <h4 className="font-medium text-gray-700 mb-1 text-sm">Why location verification?</h4>
                        <p className="text-xs text-gray-600">
                          Location verification ensures that you are physically present at the class location before marking attendance.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {isScanning ? (
                        <div>
                          <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md text-center">
                            <p className="text-sm text-green-700 font-medium">
                              ✓ Location Verified - You can now scan the QR code
                            </p>
                          </div>
                          <Html5QrcodePlugin
                            fps={10}
                            qrbox={250}
                            disableFlip={false}
                            qrCodeSuccessCallback={handleQrCodeSuccess}
                            qrCodeErrorCallback={(error) => {
                              console.warn("QR Scan Error:", error);
                              // Don't show transient errors to user while scanning
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4">
                          <Button className="mb-2" onClick={handleScanAgain}>
                            Scan Again
                          </Button>
                          <p className="text-sm text-gray-500">Scan was paused. Click to resume.</p>
                        </div>
                      )}
                      
                      {errorMessage && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                          {errorMessage}
                        </div>
                      )}
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <h4 className="font-medium text-blue-700 mb-1">Instructions:</h4>
                        <ol className="text-sm text-blue-600 list-decimal list-inside space-y-1">
                          <li>Position your camera to face the QR code displayed by your instructor</li>
                          <li>Ensure there's good lighting and hold your device steady</li>
                          <li>Wait for the QR code to be recognized</li>
                          <li>Your attendance will be recorded automatically</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {redirectUrl && (
        <div className="fixed bottom-4 right-4 flex items-center bg-primary text-white p-3 rounded-lg shadow-lg">
          <span className="mr-2">Redirecting to dashboard...</span>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};


export default StudentScannerPage;
