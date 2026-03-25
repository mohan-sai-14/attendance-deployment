import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { Html5QrcodePlugin } from '../../components/student/html5-qrcode-plugin';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle, Loader2, MapPin, AlertCircle, QrCode, RefreshCw, Shield } from 'lucide-react';
import { getCurrentPosition, verifyLocation, formatDistance } from '@/lib/location';
import { getApiUrl } from '@/lib/config';
import { validateQRToken } from '@/lib/qr-token';
import { cn } from '@/lib/utils';
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
                title: "\u26A0️ Different Network Detected",
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
        const response = await axios.get(getApiUrl(`/api/sessions/code/${activeSession.id}`), {
          withCredentials: true
        });
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
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] dark:bg-[#0B0F1A] px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-3xl bg-white dark:bg-[#121826] border border-[#E5E7EB] dark:border-[#1F2937] shadow-xl flex items-center justify-center">
              <QrCode className="h-10 w-10 text-[#9CA3AF]" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-black">!</span>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[#111827] dark:text-[#E5E7EB] tracking-tight">No Active Session</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
              Your teacher hasn't started an attendance session yet. Please check back shortly.
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/student'}
            className="w-full h-14 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] text-sm tracking-wide"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-12 min-h-[calc(100vh-4rem)] flex flex-col justify-center animate-in fade-in duration-700">
      {/* Header Branding */}
      <header className="mb-10 text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tighter">Attendance Portal</h1>
        <p className="text-muted-foreground font-medium text-sm">Verify your identity and location to proceed.</p>
      </header>
      
      {!activeSession ? (
        <Card className="border-border shadow-xl bg-card rounded-[2rem] overflow-hidden p-10 text-center border-dashed">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center border border-border">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">Station Inactive</h2>
              <p className="text-muted-foreground font-medium text-sm px-6">
                There are no live attendance sessions currently broadcasted for your section.
              </p>
            </div>
            <Button 
               onClick={() => window.location.href = '/student/dashboard'} 
               className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl shadow-xl transition-all active:scale-[0.98]"
            >
              Return to Dashboard
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl bg-white dark:bg-[#121826] rounded-[2.5rem] overflow-hidden">
          {/* Progress Indicator */}
          <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#1F2937] px-8 py-6">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 w-full h-[1px] bg-border -z-0 -translate-y-[6px]"></div>
              
              {/* Step 1: Location */}
              <div className="flex flex-col items-center gap-2 relative z-10 bg-card px-1 group">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
                  locationVerified || success 
                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : !locationVerified && !success 
                      ? "bg-card border-primary text-primary" 
                      : "bg-card border-border text-muted-foreground"
                )}>
                  <div className="transition-transform duration-500">
                    {locationVerified || success ? <CheckCircle className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                  </div>
                </div>
                <span className={cn("text-[9px] font-black uppercase tracking-[0.1em] mt-1", (locationVerified || success || (!locationVerified && !success)) ? "text-primary" : "text-muted-foreground")}>Location</span>
              </div>
              
              {/* Step 2: QR Scan */}
              <div className="flex flex-col items-center gap-2 relative z-10 bg-card px-1 group">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
                  showFaceVerification || success 
                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : locationVerified && !showFaceVerification && !success 
                      ? "bg-card border-primary text-primary" 
                      : "bg-card border-border text-muted-foreground"
                )}>
                  <div className="transition-transform duration-500">
                    {showFaceVerification || success ? <CheckCircle className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                  </div>
                </div>
                <span className={cn("text-[9px] font-black uppercase tracking-[0.1em] mt-1", (showFaceVerification || success || (locationVerified && !showFaceVerification && !success)) ? "text-primary" : "text-muted-foreground")}>QR SCAN</span>
              </div>
              
              {/* Step 3: Face */}
              <div className="flex flex-col items-center gap-2 relative z-10 bg-card px-1 group">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-500",
                  success 
                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : showFaceVerification && !success 
                      ? "bg-card border-primary text-primary" 
                      : "bg-card border-border text-muted-foreground"
                )}>
                  <div className="transition-transform duration-500">
                    {success ? <CheckCircle className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                  </div>
                </div>
                <span className={cn("text-[9px] font-black uppercase tracking-[0.1em] mt-1", (success || (showFaceVerification && !success)) ? "text-primary" : "text-muted-foreground")}>IDENTITY</span>
              </div>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8">
            <div className="space-y-8">
              {/* Session Context Banner */}
              {!success && (
                <div className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-2xl p-5 flex justify-between items-center text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01]">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-[0.2em] mb-1">Marking Attendance for</p>
                    <h4 className="font-extrabold text-lg leading-none tracking-tight">{activeSession.name}</h4>
                    <p className="text-xs font-medium text-white/50">{activeSession.time}</p>
                  </div>
                  <div className="h-8 px-3 flex items-center bg-white/15 border border-white/20 rounded-full">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Live</span>
                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  </div>
                </div>
              )}

              <div className="w-full flex flex-col justify-center">
                {showFaceVerification ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-1">Step 2 of 3</p>
                      <h3 className="text-xl font-black text-[#111827] dark:text-[#E5E7EB] tracking-tight">Face Verification</h3>
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Follow the prompts to verify your identity.</p>
                    </div>

                    {isCameraActive && !livenessPassed && !livenessFailed && livenessChallenges.length > 0 && (
                      <motion.div 
                        key={currentChallengeIndex}
                        initial={{ scale: 0.9, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 p-4 rounded-2xl text-center"
                      >
                        <p className="text-indigo-700 dark:text-indigo-300 font-bold text-base mb-2">
                          {(() => {
                            const inst = livenessChallenges[currentChallengeIndex].instruction;
                            const map: Record<string, string> = {
                              'LOOK UP': 'Gently tilt your head up',
                              'LOOK DOWN': 'Gently tilt your head down',
                              'LOOK LEFT': 'Turn your head slightly left',
                              'LOOK RIGHT': 'Turn your head slightly right',
                              'TURN LEFT': 'Turn your head slightly left',
                              'TURN RIGHT': 'Turn your head slightly right',
                            };
                            return map[inst?.toUpperCase()] || inst;
                          })()}
                        </p>
                        <div className="flex items-center justify-center gap-1.5">
                          {[...Array(livenessChallenges.length)].map((_, i) => (
                            <div key={i} className={cn("h-1.5 rounded-full transition-all duration-500", i === currentChallengeIndex ? "w-6 bg-indigo-500" : (i < currentChallengeIndex ? "w-2 bg-indigo-300" : "w-2 bg-indigo-200 dark:bg-indigo-800"))}></div>
                          ))}
                        </div>
                        <p className="text-[10px] text-indigo-500/70 font-medium mt-1.5 uppercase tracking-widest">
                          Step {currentChallengeIndex + 1} of {livenessChallenges.length}
                        </p>
                      </motion.div>
                    )}

                    <div className="relative group max-w-[300px] mx-auto">
                      {/* Glowing border ring when liveness is passing */}
                      <div className={cn(
                        "absolute -inset-1 rounded-[3rem] transition-all duration-700",
                        livenessPassed
                          ? "bg-gradient-to-br from-green-400 to-emerald-500 opacity-80"
                          : isCameraActive
                          ? "bg-gradient-to-br from-indigo-500 via-blue-500 to-indigo-400 opacity-40 animate-pulse"
                          : "opacity-0"
                      )} />
                      <div className="relative aspect-square rounded-[2.8rem] overflow-hidden shadow-2xl border-2 border-white/10 dark:border-[#1F2937]">
                        {isCameraActive ? (
                          <>
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                            {/* Face oval guide */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className={cn(
                                "w-44 h-52 border-2 rounded-[6rem] transition-all duration-700",
                                livenessPassed ? "border-green-400" : "border-white/30"
                              )} />
                            </div>
                            {/* Camera Toggle */}
                            {faceDevices.length > 1 && (
                              <button
                                onClick={switchFaceCamera}
                                disabled={isSwitchingFaceCamera}
                                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-2xl bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-all active:scale-95 disabled:opacity-50 border border-white/10 shadow-xl"
                                aria-label="Switch camera"
                              >
                                <RefreshCw className={cn("w-4 h-4", isSwitchingFaceCamera && "animate-spin")} />
                              </button>
                            )}
                            {/* Success check overlay */}
                            {livenessPassed && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="absolute inset-0 flex items-center justify-center bg-green-500/10"
                              >
                                <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center shadow-xl">
                                  <CheckCircle className="h-8 w-8 text-white" />
                                </div>
                              </motion.div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full bg-[#0B0F1A] dark:bg-[#0B0F1A] text-[#9CA3AF] gap-4 aspect-square">
                            <div className="h-16 w-16 rounded-full border-4 border-[#1F2937] border-t-indigo-500 animate-spin" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Initializing...</span>
                          </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    </div>



                    <div className="flex flex-col gap-3 pt-2">
                      {!isCameraActive ? (
                        <button
                          onClick={() => startCamera()}
                          disabled={!modelsLoaded}
                          className="w-full h-14 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none"
                        >
                          {modelsLoaded ? 'Activate Camera' : 'Loading models...'}
                        </button>
                      ) : (
                        <button
                          onClick={verifyFaceAndMarkAttendance}
                          disabled={isVerifying || !livenessPassed || livenessFailed}
                          className={cn(
                            "w-full h-14 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-[0.98]",
                            !livenessPassed || livenessFailed
                              ? "bg-[#F3F4F6] dark:bg-[#1F2937] text-[#9CA3AF] cursor-not-allowed opacity-60"
                              : "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25"
                          )}
                        >
                          {isVerifying ? (
                            <span className="flex items-center justify-center gap-2.5">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Verifying...
                            </span>
                          ) : livenessFailed ? 'Verification Failed' : !livenessPassed ? 'Complete the steps above' : 'Verify & Sign Attendance'}
                        </button>
                      )}

                      {livenessFailed && (
                        <button onClick={() => startCamera()} className="w-full h-10 rounded-xl text-rose-500 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                          <RefreshCw className="h-4 w-4" />
                          Try Again
                        </button>
                      )}

                      <button onClick={cancelFaceVerification} className="w-full h-10 rounded-xl text-[#9CA3AF] font-medium text-sm hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : success ? (
                  <div className="text-center space-y-8 py-10">
                    <motion.div
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      className="relative w-fit mx-auto"
                    >
                      <div className="absolute -inset-3 rounded-full bg-green-400/20 blur-xl animate-pulse" />
                      <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-green-500/30 relative">
                        <CheckCircle className="h-12 w-12" strokeWidth={2.5} />
                      </div>
                    </motion.div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-[#111827] dark:text-[#E5E7EB] tracking-tight">Authenticated!</h3>
                      <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] px-4">Your attendance has been securely recorded.</p>
                    </div>
                    <button
                      onClick={() => window.location.href = '/student/dashboard'}
                      className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                ) : isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-6">
                    {/* Shimmer skeleton */}
                    <div className="w-full space-y-3">
                      <div className="h-16 w-full rounded-2xl bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] dark:from-[#1F2937] dark:via-[#374151] dark:to-[#1F2937] animate-pulse rounded-2xl" />
                      <div className="h-48 w-full rounded-2xl bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] dark:from-[#1F2937] dark:via-[#374151] dark:to-[#1F2937] animate-pulse" />
                      <div className="h-10 w-2/3 mx-auto rounded-xl bg-gradient-to-r from-[#F3F4F6] via-[#E5E7EB] to-[#F3F4F6] dark:from-[#1F2937] dark:via-[#374151] dark:to-[#1F2937] animate-pulse" />
                    </div>
                    <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-widest">Validating QR...</p>
                  </div>
                ) : !locationVerified ? (
                  <div className="space-y-8 py-8">
                    <div className="text-center space-y-4">
                      <div className="relative w-fit mx-auto">
                        <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/40 flex items-center justify-center">
                          <MapPin className="h-9 w-9 text-indigo-500" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-xl font-bold text-[#111827] dark:text-[#E5E7EB] tracking-tight">Location Check</h3>
                        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] px-4 leading-relaxed">We need to confirm you're in the lecture hall before scanning.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleVerifyLocation}
                      disabled={isVerifyingLocation}
                      className="w-full h-14 rounded-2xl font-bold text-base tracking-wide transition-all active:scale-[0.98] disabled:opacity-60 bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25"
                    >
                      {isVerifyingLocation ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Getting location...
                        </span>
                      ) : 'Confirm my Location'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8 py-6 animate-in fade-in duration-700">
                    {isScanning ? (
                      <div className="space-y-5">
                        <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl p-3 flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800/40">
                          <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-widest">Location Verified</span>
                        </div>

                        {/* QR Scanner with animated frame overlay */}
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#E5E7EB] dark:border-[#1F2937] bg-black">
                          <Html5QrcodePlugin
                            fps={10}
                            qrbox={250}
                            disableFlip={false}
                            qrCodeSuccessCallback={handleQrCodeSuccess}
                            qrCodeErrorCallback={(error) => {
                              console.warn("QR Scan Error:", error);
                            }}
                          />
                          {/* Glowing frame overlay */}
                          <div className="absolute inset-0 pointer-events-none z-10">
                            {/* Corner accents */}
                            <div className="absolute top-6 left-6 w-8 h-8 border-t-[3px] border-l-[3px] border-indigo-400 rounded-tl-xl" />
                            <div className="absolute top-6 right-6 w-8 h-8 border-t-[3px] border-r-[3px] border-indigo-400 rounded-tr-xl" />
                            <div className="absolute bottom-10 left-6 w-8 h-8 border-b-[3px] border-l-[3px] border-indigo-400 rounded-bl-xl" />
                            <div className="absolute bottom-10 right-6 w-8 h-8 border-b-[3px] border-r-[3px] border-indigo-400 rounded-br-xl" />
                          </div>
                        </div>

                        <p className="text-center text-[11px] font-medium text-[#9CA3AF] tracking-wide">Point your camera at the teacher's screen</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-6 bg-gray-50 rounded-[2.5rem] border border-dashed border-border">
                        <div className="h-20 w-20 rounded-3xl bg-card flex items-center justify-center text-muted-foreground border border-gray-100 shadow-sm">
                           <QrCode className="h-10 w-10 opacity-40" />
                        </div>
                        <div className="text-center space-y-1">
                           <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Scanner Sleeping</p>
                           <Button onClick={handleScanAgain} variant="link" className="text-primary font-black uppercase text-[10px] tracking-widest hover:no-underline">Wake Scanner</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {errorMessage && !showFaceVerification && !success && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-5 p-4 bg-[#FEE2E2] dark:bg-red-950/40 border border-[#FECACA] dark:border-red-800/50 rounded-2xl flex items-start gap-3"
                  >
                    <AlertCircle className="w-4 h-4 text-[#991B1B] dark:text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-[#991B1B] dark:text-red-300 leading-snug">{errorMessage}</p>
                  </motion.div>
                )}
              </div>
            </div>
          </CardContent>
          
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-4 flex items-center justify-center gap-3">
            <Shield className="h-3 w-3 text-white/50" />
            <span className="text-[8px] font-bold text-white/70 uppercase tracking-[0.3em]">End-to-End Encrypted</span>
          </div>
        </Card>
      )}

      {/* Permission Request Dialog */}
      <AnimatePresence>
        {showPermissionDialog && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setShowPermissionDialog(false)}
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-card rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl border border-border w-full max-w-sm p-10 space-y-8 relative z-10"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className={cn(
                  "w-24 h-24 rounded-[2rem] flex items-center justify-center rotate-6",
                  permissionStatus === 'denied' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-primary/10 text-primary border border-primary/20'
                )}>
                  {permissionStatus === 'denied' ? (
                    <Shield className="h-12 w-12 -rotate-6" />
                  ) : (
                    permissionType === 'location' ? <MapPin className="h-12 w-12 -rotate-6" /> : <Camera className="h-12 w-12 -rotate-6" />
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-foreground tracking-tighter leading-none">
                    {permissionStatus === 'denied' ? "Sensor Blocked" : "Sensor Access"}
                  </h3>
                  <p className="text-muted-foreground font-medium text-sm">
                    {permissionType === 'location'
                      ? 'Confirming your physical presence in the lecture hall.'
                      : 'Activating biometric sensors for identity validation.'
                    }
                  </p>
                </div>
              </div>

              {permissionStatus === 'denied' ? (
                <div className="bg-muted/30 rounded-3xl p-6 space-y-4">
                  <div className="text-[10px] font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                    <span className="text-primary">⚙</span>
                    How to Unblock
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-3 font-medium">
                    <li className="flex gap-2"><span>1.</span> <span>Tap the <strong>Lock icon</strong> ({"\u{1F512}"}) in address bar.</span></li>
                    <li className="flex gap-2"><span>2.</span> <span>Allow <strong>{permissionType === 'location' ? 'Location' : 'Camera'}</strong>.</span></li>
                    <li className="flex gap-2"><span>3.</span> <span>Reload to sync permissions.</span></li>
                  </ol>
                </div>
              ) : (
                <div className="bg-emerald-50 rounded-3xl p-6">
                  <p className="text-xs text-emerald-700 font-bold leading-relaxed text-center italic">
                    {permissionType === 'location'
                      ? '\u{1F4CD} Tap "Allow" when the browser asks for your location.'
                      : '\u{1F4F7} Tap "Allow" when the browser asks for camera access.'
                    }
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {permissionStatus === 'denied' ? (
                  <>
                    <Button onClick={() => { setShowPermissionDialog(false); window.location.reload(); }} className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-gray-200 border-0">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reload Portal
                    </Button>
                    <Button variant="ghost" onClick={() => setShowPermissionDialog(false)} className="w-full text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Close</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleGrantPermission} className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-gray-200 border-0">
                      I Understand
                    </Button>
                    <Button variant="ghost" onClick={() => setShowPermissionDialog(false)} className="w-full text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Cancel</Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {redirectUrl && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-primary text-white px-6 py-3 rounded-full shadow-2xl z-[150] animate-in slide-in-from-bottom-5">
          <div className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Redirecting...</span>
        </div>
      )}
    </div>
  );
};



export default StudentScannerPage;
