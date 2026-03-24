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
import { Camera, CheckCircle, XCircle, Loader2, MapPin, AlertCircle, QrCode, RefreshCw, ZoomIn, ZoomOut, Shield, Settings, ExternalLink } from 'lucide-react';
import { getCurrentPosition, verifyLocation, formatDistance } from '@/lib/location';
import { getApiUrl } from '@/lib/config';
import { validateQRToken } from '@/lib/qr-token';
import { 
  getHeadMovement, 
  generateChallenges, 
  LivenessChallenge 
} from '@/lib/liveness';


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
  
  // Liveness states
  const [livenessChallenges, setLivenessChallenges] = useState<LivenessChallenge[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessFailed, setLivenessFailed] = useState(false);
  
  // Camera switching & zoom states for face verification
  const [faceDevices, setFaceDevices] = useState<MediaDeviceInfo[]>([]);
  const [faceCameraIndex, setFaceCameraIndex] = useState(0);
  const [faceZoomLevel, setFaceZoomLevel] = useState(1);
  const [faceZoomRange, setFaceZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [isSwitchingFaceCamera, setIsSwitchingFaceCamera] = useState(false);
  
  // Permission dialog states
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [permissionType, setPermissionType] = useState<'location' | 'camera'>('location');
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'denied' | 'granted'>('prompt');
  
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

  // Directly fetch active session scoped to student
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchActiveSession = async () => {
      if (!user?.username) return;

      try {
        console.log('Scanner: Fetching active session...');
        
        // 1. Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('username', user.username)
          .single();
          
        if (!profile) return;

        // 2. Fetch matching classes
        const { data: matchingClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('department', profile.department)
          .eq('program', profile.program)
          .eq('year', profile.year)
          .eq('section', profile.section);
          
        const classIds = (matchingClasses || []).map(c => c.id);
        
        if (classIds.length === 0) {
          setActiveSession(null);
          return;
        }

        // 3. Fetch active sessions limited to student's classes
        const { data: sessions, error } = await supabase
          .from('sessions')
          .select('*')
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('check_in_time', { ascending: false })
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
    intervalId = setInterval(fetchActiveSession, 10000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [user?.username]);

  // Permission check helpers
  const checkPermission = async (type: 'location' | 'camera'): Promise<boolean> => {
    try {
      if (type === 'location') {
        // Check location permission status
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if (result.state === 'denied') {
            setPermissionType('location');
            setPermissionStatus('denied');
            setShowPermissionDialog(true);
            return false;
          }
          if (result.state === 'prompt') {
            setPermissionType('location');
            setPermissionStatus('prompt');
            setShowPermissionDialog(true);
            return false;
          }
        }
      } else {
        // Check camera permission status
        if (navigator.permissions) {
          try {
            const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
            if (result.state === 'denied') {
              setPermissionType('camera');
              setPermissionStatus('denied');
              setShowPermissionDialog(true);
              return false;
            }
            if (result.state === 'prompt') {
              setPermissionType('camera');
              setPermissionStatus('prompt');
              setShowPermissionDialog(true);
              return false;
            }
          } catch {
            // Some browsers don't support camera permission query — proceed normally
          }
        }
      }
      return true;
    } catch {
      return true; // On error, proceed anyway and let the actual API handle it
    }
  };

  const handleGrantPermission = async () => {
    setShowPermissionDialog(false);
    if (permissionType === 'location') {
      // Trigger actual location request which shows browser prompt
      doVerifyLocation();
    } else {
      // Trigger actual camera request which shows browser prompt
      startCamera();
    }
  };

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

    // Check permission first
    const hasPermission = await checkPermission('location');
    if (!hasPermission) return;

    doVerifyLocation();
  };

  const doVerifyLocation = async () => {
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
      
      // Check if it's a permission denial
      const errMsg = locationError instanceof Error ? locationError.message : '';
      if (errMsg.includes('denied') || errMsg.includes('permission')) {
        setPermissionType('location');
        setPermissionStatus('denied');
        setShowPermissionDialog(true);
      } else {
        toast({
          variant: "destructive",
          title: "Location Required",
          description: errMsg || "Unable to get your location. Please enable location access.",
          duration: 8000
        });
      }
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

        console.log("Scanner User Profile Check:", {
          id: userProfile?.id,
          username: userProfile?.username,
          hasEmbeddings: !!userProfile?.face_embeddings,
          status: userProfile?.face_enrollment_status
        });
        
        console.log("Complete user profile data:", userProfile);
        
        // Get the active session directly from Supabase using the sessionId from QR
        const { data: activeSessionData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionData.sessionId)
          .single();
          
        if (sessionsError || !activeSessionData) {
          console.error("Error fetching active session:", sessionsError);
          setErrorMessage('Error accessing session data. The session may not exist.');
          return;
        }
        
        if (!activeSessionData.is_active) {
          setErrorMessage('This session is no longer active.');
          return;
        }
        
        // Validate that this student belongs to the class for this session
        if (activeSessionData.class_id) {
          const { data: classData } = await supabase
             .from('classes')
             .select('*')
             .eq('id', activeSessionData.class_id)
             .single();
          
          if (classData) {
             const studentMatches = 
                classData.department === userProfile.department &&
                classData.program === userProfile.program &&
                classData.year === userProfile.year &&
                classData.section === userProfile.section;

             if (!studentMatches) {
                 setErrorMessage('You are not authorized to mark attendance for this class session.');
                 setIsLoading(false);
                 setIsScanning(true);
                 toast({ 
                   variant: "destructive", 
                   title: "Unauthorized", 
                   duration: 5000, 
                   description: "This QR code belongs to a different class." 
                 });
                 return;
             }
          }
        }

        console.log("Active session in database:", activeSessionData);
        
        // Validate rotating QR token if qr_secret exists
        if (activeSessionData.qr_secret && sessionData.ts && sessionData.token) {
          console.log("Validating rotating QR token...");
          const validation = await validateQRToken(
            decodedText,
            activeSessionData.qr_secret,
            10000 // 10-second window
          );
          
          if (!validation.valid) {
            console.warn("QR token validation failed:", validation.error);
            setErrorMessage(validation.error || 'Invalid or expired QR code. Please scan the current code on the screen.');
            setIsLoading(false);
            setIsScanning(true); // Re-enable scanning so they can try again
            toast({
              variant: "destructive",
              title: "QR Code Expired",
              description: validation.error || "This QR code has expired. Please scan the latest code.",
              duration: 5000
            });
            return;
          }
          console.log("QR token validated successfully");
        } else if (activeSessionData.qr_secret && !sessionData.token) {
          // Session has rotation enabled but QR doesn't have a token — old/static QR
          setErrorMessage('This QR code is outdated. Please scan the live rotating code displayed by your teacher.');
          setIsLoading(false);
          setIsScanning(true);
          toast({
            variant: "destructive",
            title: "Outdated QR Code",
            description: "Please scan the current QR code from the teacher's screen.",
            duration: 5000
          });
          return;
        }
        
        // IP-based network verification (soft check)
        let ipMatch = null; // null = couldn't check, true = match, false = mismatch
        if (activeSessionData.teacher_ip) {
          try {
            const ipResp = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResp.json();
            const studentIp = ipData.ip || '';
            ipMatch = studentIp === activeSessionData.teacher_ip;
            console.log(`IP check: student=${studentIp}, teacher=${activeSessionData.teacher_ip}, match=${ipMatch}`);
            
            if (!ipMatch) {
              toast({
                variant: "default",
                title: "⚠️ Different Network Detected",
                description: "You appear to be on a different network than the teacher. Attendance will proceed but this is logged.",
                duration: 5000
              });
            }
          } catch (ipErr) {
            console.warn('IP check failed:', ipErr);
          }
        }
        
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
        setLivenessChallenges(generateChallenges());
        setCurrentChallengeIndex(0);
        setLivenessPassed(false);
        setLivenessFailed(false);
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
  const startCamera = async (deviceId?: string) => {
    try {
      setIsCameraActive(true);
      setLivenessPassed(false);
      setLivenessFailed(false);
      setLivenessChallenges(generateChallenges());
      setCurrentChallengeIndex(0);
      setFaceZoomRange(null);
      setFaceZoomLevel(1);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Enumerate cameras if not done yet
      if (faceDevices.length === 0) {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setFaceDevices(videoDevices);
        console.log('Face verification cameras:', videoDevices);
        // Default to front camera
        const frontIdx = videoDevices.findIndex(d => d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user'));
        if (!deviceId && frontIdx >= 0) {
          setFaceCameraIndex(frontIdx);
          deviceId = videoDevices[frontIdx].deviceId;
        } else if (!deviceId && videoDevices.length > 0) {
          deviceId = videoDevices[0].deviceId;
        }
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { width: 640, height: 480, facingMode: 'user' }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
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

        // Detect zoom capability
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.zoom) {
            setFaceZoomRange({
              min: capabilities.zoom.min || 1,
              max: capabilities.zoom.max || 10,
              step: capabilities.zoom.step || 0.1
            });
            setFaceZoomLevel(capabilities.zoom.min || 1);
            console.log('Face camera zoom capability:', capabilities.zoom);
          }
        }
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

  // Liveness detection loop
  useEffect(() => {
    let animationFrameId: number;
    let lastProcessTime = 0;
    
    const detectLiveness = async () => {
      if (!isCameraActive || !videoRef.current || livenessPassed || livenessFailed || livenessChallenges.length === 0) return;
      
      const now = Date.now();
      if (now - lastProcessTime < 60) { // Limit to ~16fps to save CPU (was 100ms/10fps)
        animationFrameId = requestAnimationFrame(detectLiveness);
        return;
      }
      lastProcessTime = now;

      const video = videoRef.current;
      if (video.readyState !== 4) {
        animationFrameId = requestAnimationFrame(detectLiveness);
        return;
      }
      
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();
          
        if (detection) {
          const currentChallenge = livenessChallenges[currentChallengeIndex];
          
          const movement = getHeadMovement(detection.landmarks);
          const targetDirection = currentChallenge.type.replace('turn_', '');
          
          if (movement.direction === targetDirection) {
            handleChallengeSuccess();
          }
        }
      } catch (e) {
        console.warn("Liveness parsing skipped frame", e);
      }
      
      if (!livenessPassed && !livenessFailed) {
        animationFrameId = requestAnimationFrame(detectLiveness);
      }
    };
    
    const handleChallengeSuccess = () => {
      const nextIndex = currentChallengeIndex + 1;
      if (nextIndex >= livenessChallenges.length) {
        setLivenessPassed(true);
        toast({ title: "Liveness Verified", description: "Please hold still for face authentication.", duration: 2000 });
      } else {
        setCurrentChallengeIndex(nextIndex);
      }
    };
    
    if (isCameraActive && !livenessPassed && !livenessFailed && livenessChallenges.length > 0) {
      detectLiveness();
    }
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isCameraActive, livenessPassed, livenessFailed, livenessChallenges, currentChallengeIndex, toast]);

  // Liveness timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isCameraActive && !livenessPassed && !livenessFailed) {
      timeoutId = setTimeout(() => {
        setLivenessFailed(true);
        toast({
          variant: "destructive",
          title: "Liveness Check Failed",
          description: "Time expired. Please try again."
        });
      }, 15000); // 15 seconds to complete
    }
    return () => clearTimeout(timeoutId);
  }, [isCameraActive, livenessPassed, livenessFailed, toast]);

  const switchFaceCamera = async () => {
    if (faceDevices.length < 2 || isSwitchingFaceCamera) return;
    setIsSwitchingFaceCamera(true);
    try {
      stopCamera();
      await new Promise(resolve => setTimeout(resolve, 300));
      const nextIndex = (faceCameraIndex + 1) % faceDevices.length;
      setFaceCameraIndex(nextIndex);
      await startCamera(faceDevices[nextIndex].deviceId);
    } catch (err) {
      console.error('Error switching face camera:', err);
    } finally {
      setIsSwitchingFaceCamera(false);
    }
  };

  const applyFaceZoom = async (zoom: number) => {
    try {
      if (streamRef.current) {
        const track = streamRef.current.getVideoTracks()[0];
        if (track) {
          await track.applyConstraints({ advanced: [{ zoom } as any] });
          setFaceZoomLevel(zoom);
        }
      }
    } catch (e) {
      console.error('Failed to apply face zoom:', e);
    }
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

      // Face verified locally! Now mark attendance via secure backend endpoint
      const { sessionData, dateString, localTimestamp, studentLocation } = scannedSessionData;
      
      try {
        const response = await axios.post(getApiUrl('/api/verify-face'), {
          sessionId: sessionData.id,
          faceDescriptor: capturedEmbedding,
          studentLat: studentLocation?.lat,
          studentLng: studentLocation?.lng,
          localTimestamp: localTimestamp,
          dateString: dateString
        }, {
          withCredentials: true // To ensure session cookie is sent correctly
        });
        
        if (!response.data.success) {
          toast({ variant: "destructive", title: "Verification Failed", description: response.data.message });
          setIsVerifying(false);
          return;
        }
      } catch (err: any) {
        console.error("Backend Error recording attendance:", err);
        toast({ variant: "destructive", title: "Error", description: err.response?.data?.message || "Failed to record attendance securely via the server." });
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
        const response = await axios.get(getApiUrl(`/api/sessions/code/${activeSession.id}`));
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
    <div className="max-w-md mx-auto p-4 sm:p-6 md:p-8 min-h-[calc(100vh-4rem)] flex flex-col justify-center animate-in fade-in duration-500">
      <div className="mb-6 space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Attendance Check-in</h1>
        <p className="text-muted-foreground text-sm">Follow the steps to mark your attendance</p>
      </div>
      
      {!activeSession ? (
        <Card className="border border-border/40 shadow-xl bg-gradient-to-br from-background to-background/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-2">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">No Active Session</h2>
              <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
                There is currently no active attendance session available for you to join.
              </p>
              <Button onClick={() => window.location.href = '/student/dashboard'} className="mt-4 w-full h-12">
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/40 shadow-xl bg-gradient-to-br from-background to-background/50 backdrop-blur-sm overflow-hidden relative">
          {/* Step Indicator Top Bar */}
          <div className="bg-muted/30 border-b border-border/40 p-4 shrink-0">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 w-full h-0.5 bg-border/50 -z-10 -translate-y-1/2"></div>
              
              {/* Step 1: Location */}
              <div className="flex flex-col items-center gap-1.5 bg-background/90 px-2 relative transition-all duration-300">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${locationVerified || success ? 'bg-primary text-primary-foreground border-primary scale-110' : !locationVerified && !success ? 'bg-background border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'bg-muted border-border text-muted-foreground'}`}>
                  {locationVerified || success ? <CheckCircle className="w-4 h-4 animate-in zoom-in" /> : <MapPin className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${locationVerified || success || (!locationVerified && !success) ? 'text-primary' : 'text-muted-foreground'}`}>Location</span>
              </div>
              
              {/* Step 2: Scan */}
              <div className="flex flex-col items-center gap-1.5 bg-background/90 px-2 relative transition-all duration-300">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${showFaceVerification || success ? 'bg-primary text-primary-foreground border-primary scale-110' : locationVerified && !showFaceVerification && !success ? 'bg-background border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'bg-muted border-border text-muted-foreground'}`}>
                  {showFaceVerification || success ? <CheckCircle className="w-4 h-4 animate-in zoom-in" /> : <QrCode className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${showFaceVerification || success || (locationVerified && !showFaceVerification && !success) ? 'text-primary' : 'text-muted-foreground'}`}>Scan QR</span>
              </div>
              
              {/* Step 3: Face */}
              <div className="flex flex-col items-center gap-1.5 bg-background/90 px-2 relative transition-all duration-300">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${success ? 'bg-primary text-primary-foreground border-primary scale-110' : showFaceVerification && !success ? 'bg-background border-primary text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'bg-muted border-border text-muted-foreground'}`}>
                  {success ? <CheckCircle className="w-4 h-4 animate-in zoom-in" /> : <Camera className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${success || (showFaceVerification && !success) ? 'text-primary' : 'text-muted-foreground'}`}>Verify Face</span>
              </div>
            </div>
          </div>
          
          <CardContent className="p-5">
            <div className="space-y-6">
              {/* Active Session Info Snippet */}
              {!success && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-xl -mr-8 -mt-8"></div>
                  <div>
                    <h4 className="font-semibold text-sm relative z-10">{activeSession.name}</h4>
                    <p className="text-xs text-muted-foreground relative z-10">{activeSession.time}</p>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase text-[10px] tracking-wider px-2 relative z-10">Live</Badge>
                </div>
              )}
              <div className="w-full pt-4 min-h-[350px] flex flex-col justify-center">
                {showFaceVerification ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center">
                      <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">Face Verification</h3>
                      {isCameraActive && !livenessPassed && !livenessFailed && livenessChallenges.length > 0 && (
                        <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg animate-pulse shadow-sm">
                          <p className="text-primary font-bold text-lg">
                            {livenessChallenges[currentChallengeIndex].instruction}
                          </p>
                          <p className="text-xs text-primary/70 mt-1">
                            Step {currentChallengeIndex + 1} of {livenessChallenges.length}
                          </p>
                        </div>
                      )}
                      {livenessPassed && (
                        <p className="text-sm text-green-600 font-medium">Liveness verified. You may now match your face.</p>
                      )}
                      {livenessFailed && (
                        <p className="text-sm text-red-600 font-medium">Failed to verify liveness in time. Please try again.</p>
                      )}
                      {!isCameraActive && (
                        <p className="text-sm text-muted-foreground">Please position your face within the frame</p>
                      )}
                    </div>

                    <div className="relative w-full max-w-[280px] aspect-square mx-auto rounded-3xl overflow-hidden shadow-2xl ring-4 ring-primary/20 border-4 border-background">
                      {isCameraActive ? (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          <div className="absolute inset-0 border-4 border-dashed border-primary/50 rounded-3xl pointer-events-none animate-[pulse_2s_ease-in-out_infinite]"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-56 border-2 border-primary/40 rounded-[4rem] pointer-events-none"></div>
                          {/* Camera Switch Button */}
                          {faceDevices.length > 1 && (
                            <button
                              onClick={switchFaceCamera}
                              disabled={isSwitchingFaceCamera}
                              className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-all active:scale-95 disabled:opacity-50 border border-white/20 shadow-lg"
                              title="Switch Camera"
                            >
                              <RefreshCw className={`w-4 h-4 ${isSwitchingFaceCamera ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-muted/30 text-muted-foreground gap-3">
                          <Camera className="h-12 w-12 opacity-50" />
                          <span className="text-sm font-medium">Starting camera...</span>
                        </div>
                      )}
                      <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Zoom Controls for Face Camera */}
                    {faceZoomRange && isCameraActive && (
                      <div className="flex items-center gap-2 mt-3 px-2 max-w-[280px] mx-auto">
                        <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
                        <input
                          type="range"
                          min={faceZoomRange.min}
                          max={faceZoomRange.max}
                          step={faceZoomRange.step}
                          value={faceZoomLevel}
                          onChange={(e) => applyFaceZoom(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
                        />
                        <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground font-mono min-w-[2.5rem] text-right">{faceZoomLevel.toFixed(1)}x</span>
                      </div>
                    )}

                    {/* Camera Label */}
                    {faceDevices.length > 1 && isCameraActive && (
                      <p className="text-[10px] text-center mt-1.5 text-muted-foreground/60 truncate max-w-[280px] mx-auto px-2">
                        {faceDevices[faceCameraIndex]?.label || `Camera ${faceCameraIndex + 1}`}
                      </p>
                    )}

                    <div className="flex flex-col space-y-3">
                      {!isCameraActive ? (
                        <Button onClick={() => startCamera()} disabled={!modelsLoaded} className="w-full h-14 text-base rounded-xl shadow-lg shadow-primary/20 group transition-all">
                          <Camera className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                          {modelsLoaded ? 'Start Camera' : 'Loading models...'}
                        </Button>
                      ) : (
                        <Button
                          onClick={verifyFaceAndMarkAttendance}
                          disabled={isVerifying || !livenessPassed || livenessFailed}
                          className={`w-full h-14 text-base rounded-xl shadow-lg transition-all ${
                            !livenessPassed 
                              ? 'bg-muted text-muted-foreground' 
                              : 'shadow-primary/20 group'
                          }`}
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                              Verifying face match...
                            </>
                          ) : livenessFailed ? (
                            "Challenge Failed - Try Again"
                          ) : !livenessPassed ? (
                            "Complete Challenge First"
                          ) : (
                            <>
                              <CheckCircle className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                              Verify Face & Mark Attendance
                            </>
                          )}
                        </Button>
                      )}
                      
                      {livenessFailed && (
                        <Button 
                          onClick={() => startCamera()} 
                          variant="secondary"
                          className="w-full h-12 rounded-xl"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry Liveness Challenge
                        </Button>
                      )}

                      <Button variant="outline" onClick={cancelFaceVerification} className="w-full h-12 rounded-xl">
                        Cancel
                      </Button>
                    </div>

                    {errorMessage && (
                      <div className="mt-4 p-4 bg-red-500/10 border-l-4 border-red-500 rounded-r-xl text-red-700 dark:text-red-400 text-sm flex items-start gap-3 w-full">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{errorMessage}</p>
                      </div>
                    )}
                  </div>
                ) : success ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full scale-150 group-hover:bg-green-500/30 transition-colors"></div>
                      <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-xl shadow-green-500/30 relative border-4 border-background">
                        <CheckCircle className="h-12 w-12 text-white" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent mb-2">Success!</h3>
                      <p className="text-muted-foreground text-sm max-w-[250px] mx-auto">
                        Your attendance has been successfully verified and securely recorded.
                      </p>
                    </div>

                    <div className="flex flex-col w-full gap-3 pt-4">
                      <Button size="lg" className="w-full h-12" onClick={() => window.location.href = '/student/dashboard'}>
                        Return to Dashboard
                      </Button>
                    </div>
                  </div>
                ) : isLoading ? (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-primary font-medium">Verifying QR code...</p>
                  </div>
                ) : !locationVerified ? (
                  <div className="flex flex-col items-center justify-center space-y-8 py-6 animate-in fade-in duration-500">
                    <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center relative shadow-inner">
                      <div className="absolute inset-0 border border-blue-500/20 rounded-full animate-ping opacity-20"></div>
                      <MapPin className="h-10 w-10 text-blue-500" />
                    </div>

                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-bold text-foreground">Location Check</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Please verify you are physically inside the classroom before scanning.
                      </p>
                    </div>

                    <Button
                      onClick={handleVerifyLocation}
                      disabled={isVerifyingLocation}
                      className="w-full h-14 text-base rounded-xl shadow-lg group relative overflow-hidden"
                    >
                      {isVerifyingLocation ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                          Pinpointing location...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                          Verify My Location
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6 py-4 animate-in fade-in duration-500">
                    {isScanning ? (
                      <div className="space-y-4">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-green-700 dark:text-green-400 font-medium tracking-wide">
                            Location Verified
                          </p>
                        </div>
                        <div className="rounded-3xl overflow-hidden shadow-2xl ring-4 ring-primary/10 border-4 border-background bg-black/5">
                          <Html5QrcodePlugin
                            fps={10}
                            qrbox={250}
                            disableFlip={false}
                            qrCodeSuccessCallback={handleQrCodeSuccess}
                            qrCodeErrorCallback={(error) => {
                              console.warn("QR Scan Error:", error);
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-4 bg-muted/20 rounded-3xl border border-dashed border-border">
                        <QrCode className="w-16 h-16 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground font-medium">Scanner paused</p>
                        <Button variant="secondary" onClick={handleScanAgain} className="mt-2">
                          Resume Scanning
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {errorMessage && !showFaceVerification && (
                  <div className="mt-6 p-4 bg-red-500/10 border-l-4 border-red-500 rounded-r-xl text-red-700 dark:text-red-400 text-sm flex items-start gap-3 w-full">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Request Dialog */}
      {showPermissionDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background rounded-2xl shadow-2xl border border-border max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${permissionStatus === 'denied' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                {permissionStatus === 'denied' ? (
                  <Shield className={`h-8 w-8 ${permissionStatus === 'denied' ? 'text-red-500' : 'text-blue-500'}`} />
                ) : (
                  permissionType === 'location' ? <MapPin className="h-8 w-8 text-blue-500" /> : <Camera className="h-8 w-8 text-blue-500" />
                )}
              </div>
              
              <h3 className="text-xl font-bold text-foreground">
                {permissionStatus === 'denied'
                  ? `${permissionType === 'location' ? 'Location' : 'Camera'} Access Blocked`
                  : `${permissionType === 'location' ? 'Location' : 'Camera'} Access Required`
                }
              </h3>
              
              <p className="text-sm text-muted-foreground">
                {permissionType === 'location'
                  ? 'We need your location to verify you are inside the classroom before marking attendance.'
                  : 'Camera access is needed for QR code scanning and face verification.'
                }
              </p>
            </div>

            {permissionStatus === 'denied' ? (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  How to enable {permissionType === 'location' ? 'location' : 'camera'}:
                </p>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Tap the <strong>lock/info icon</strong> (🔒) in your browser's address bar</li>
                  <li>Find <strong>"{permissionType === 'location' ? 'Location' : 'Camera'}"</strong> in the permissions list</li>
                  <li>Change it from "Block" to <strong>"Allow"</strong></li>
                  <li>Reload the page and try again</li>
                </ol>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {permissionType === 'location'
                    ? '📍 When you tap "Allow Access", your browser will ask for location permission. Please tap "Allow" to continue.'
                    : '📷 When you tap "Allow Access", your browser will ask for camera permission. Please tap "Allow" to continue.'
                  }
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {permissionStatus === 'denied' ? (
                <>
                  <Button 
                    onClick={() => { setShowPermissionDialog(false); window.location.reload(); }}
                    className="w-full h-12 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPermissionDialog(false)}
                    className="w-full h-10 rounded-xl"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleGrantPermission}
                    className="w-full h-12 rounded-xl"
                  >
                    {permissionType === 'location' ? <MapPin className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                    Allow Access
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPermissionDialog(false)}
                    className="w-full h-10 rounded-xl"
                  >
                    Not Now
                  </Button>
                </>
              )}
            </div>
          </div>
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
