import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import * as faceapi from 'face-api.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  UserPlus, 
  Upload, 
  Download, 
  Search, 
  Edit, 
  Trash, 
  Camera, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  X,
  Users,
  Filter,
  Loader2
} from "lucide-react";
import { useToast } from "@/components/ui/toast-hook";
import { supabase } from "@/lib/supabase";

// Types
interface Student {
  id: string;
  username: string;
  name: string;
  email: string;
  enroll_no: string;
  registered_no: string;
  department: string;
  program: string;
  section: string;
  year: string;
  role: string;
  status: string;
  face_enrollment_status: 'not_enrolled' | 'pending' | 'enrolled' | 'failed';
  face_enrollment_date?: string;
  face_images_count: number;
  face_quality_score?: number;
  attendance_rate?: number;
}

interface FaceCaptureResult {
  image: string;
  quality_score: number;
  confidence: number;
  landmarks: any[];
}

export default function StudentManagement() {
  // State management
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Face enrollment state
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<FaceCaptureResult[]>([]);
  const [faceEmbeddings, setFaceEmbeddings] = useState<number[][]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState({
    faceDetected: false,
    properLighting: false,
    faceCentered: false,
    eyesVisible: false,
    multipleFaces: false
  });
  
  // Camera and video refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

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
        toast({
          variant: "destructive",
          title: "Model Loading Error",
          description: "Failed to load face detection models. Face enrollment may not work properly."
        });
      }
    };
    loadModels();
  }, []);

  // Fetch students data
  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search and filters
  useEffect(() => {
    let filtered = students.filter(student => {
      const matchesSearch = 
        student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.enroll_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = departmentFilter === "all" || student.department === departmentFilter;
      const matchesProgram = programFilter === "all" || student.program === programFilter;
      const matchesYear = yearFilter === "all" || student.year === yearFilter;
      const matchesSection = sectionFilter === "all" || student.section === sectionFilter;
      const matchesStatus = statusFilter === "all" || student.face_enrollment_status === statusFilter;
      
      return matchesSearch && matchesDepartment && matchesProgram && matchesYear && matchesSection && matchesStatus;
    });
    
    setFilteredStudents(filtered);
  }, [students, searchQuery, departmentFilter, programFilter, yearFilter, sectionFilter, statusFilter]);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (error) throw error;

      // Calculate attendance rates for each student
      const studentsWithAttendance = await Promise.all(
        (data || []).map(async (student) => {
          try {
            const { data: attendance } = await supabase
              .from('attendance')
              .select('*')
              .eq('username', student.username);

            const { data: sessions } = await supabase
              .from('sessions')
              .select('*', { count: 'exact' });

            const totalSessions = sessions?.length || 0;
            const attendanceCount = attendance?.length || 0;
            const attendanceRate = totalSessions > 0 ? Math.round((attendanceCount / totalSessions) * 100) : 0;

            return {
              ...student,
              attendance_rate: attendanceRate,
              face_enrollment_status: student.face_enrollment_status || 'not_enrolled',
              face_images_count: student.face_images_count || 0,
              face_quality_score: student.face_quality_score || 0
            };
          } catch (error) {
            console.error(`Error fetching attendance for student ${student.id}:`, error);
            return {
              ...student,
              attendance_rate: 0,
              face_enrollment_status: 'not_enrolled',
              face_images_count: 0,
              face_quality_score: 0
            };
          }
        })
      );

      setStudents(studentsWithAttendance);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch students data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Face enrollment functions
  const startFaceEnrollment = async (student: Student) => {
    setSelectedStudent(student);
    setShowFaceEnrollment(true);
    setCurrentStep(1);
    setCapturedImages([]);
    setEnrollmentProgress(0);
    await startCamera();
  };

  const startCamera = async () => {
    try {
      // Set isCapturing to true FIRST so the video element renders
      setIsCapturing(true);
      
      // Wait a moment for React to render the video element
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video metadata to load, then play
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
              toast({
                variant: "destructive",
                title: "Video Playback Error",
                description: "Failed to start video playback. Please try again."
              });
            });
          }
        };
        
        startFaceDetection();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsCapturing(false); // Reset on error
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions.",
      });
    }
  };

  const startFaceDetection = async () => {
    if (!modelsLoaded || !videoRef.current) return;

    detectionIntervalRef.current = setInterval(async () => {
      if (!isCapturing || !videoRef.current) {
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
        }
        return;
      }

      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (detections.length === 0) {
          setFaceDetectionStatus({
            faceDetected: false,
            properLighting: false,
            faceCentered: false,
            eyesVisible: false,
            multipleFaces: false
          });
          return;
        }

        const face = detections[0];
        const video = videoRef.current;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Calculate face position
        const faceCenterX = face.detection.box.x + face.detection.box.width / 2;
        const faceCenterY = face.detection.box.y + face.detection.box.height / 2;
        const videoCenterX = videoWidth / 2;
        const videoCenterY = videoHeight / 2;
        const distanceFromCenter = Math.sqrt(
          Math.pow(faceCenterX - videoCenterX, 2) + Math.pow(faceCenterY - videoCenterY, 2)
        );

        // Calculate face size
        const faceArea = face.detection.box.width * face.detection.box.height;
        const videoArea = videoWidth * videoHeight;
        const faceSizeRatio = faceArea / videoArea;

        // Check eyes visibility
        const leftEye = face.landmarks.getLeftEye();
        const rightEye = face.landmarks.getRightEye();
        const eyesVisible = leftEye.length > 0 && rightEye.length > 0;

        setFaceDetectionStatus({
          faceDetected: true,
          properLighting: face.detection.score > 0.7,
          faceCentered: distanceFromCenter < (videoWidth * 0.2) && faceSizeRatio > 0.05 && faceSizeRatio < 0.25,
          eyesVisible,
          multipleFaces: detections.length > 1
        });
      } catch (error) {
        console.error('Face detection error:', error);
      }
    }, 200);
  };

  const startAutoCapture = () => {
    if (!modelsLoaded || !videoRef.current || isAutoCapturing) return;

    setIsAutoCapturing(true);
    setCapturedImages([]);
    setFaceEmbeddings([]);
    setEnrollmentProgress(0);

    let captureCount = 0;
    const maxCaptures = 50;

    captureIntervalRef.current = setInterval(async () => {
      if (captureCount >= maxCaptures) {
        stopAutoCapture();
        toast({
          title: "Capture Complete",
          description: `Successfully captured ${maxCaptures} face images`,
        });
        return;
      }

      try {
        const result = await captureFaceWithEmbedding();
        if (result) {
          captureCount++;
          setEnrollmentProgress(Math.round((captureCount / maxCaptures) * 100));
        }
      } catch (error) {
        console.error('Auto capture error:', error);
      }
    }, 300); // Capture every 300ms
  };

  const stopAutoCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setIsAutoCapturing(false);
  };

  const captureFaceWithEmbedding = async (): Promise<boolean> => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded) return false;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return false;

    try {
      // Detect face with descriptor
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        return false; // No face detected, skip this frame
      }

      if (detections.length > 1) {
        return false; // Multiple faces, skip this frame
      }

      const face = detections[0];

      // Draw to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      // Calculate quality score
      const qualityScore = face.detection.score * 10;
      const confidence = face.detection.score * 100;

      const captureResult: FaceCaptureResult = {
        image: imageData,
        quality_score: qualityScore,
        confidence: confidence,
        landmarks: face.landmarks.positions
      };

      // Store embedding
      const embedding = Array.from(face.descriptor);
      setFaceEmbeddings(prev => [...prev, embedding]);
      setCapturedImages(prev => [...prev, captureResult]);

      return true;
    } catch (error) {
      console.error('Face capture error:', error);
      return false;
    }
  };

  const saveFaceEmbeddings = async () => {
    if (!selectedStudent || faceEmbeddings.length === 0) return;

    try {
      // Calculate average embedding
      const avgEmbedding = calculateAverageEmbedding(faceEmbeddings);

      const { error } = await supabase
        .from('users')
        .update({
          face_embeddings: avgEmbedding,
          face_enrollment_status: 'enrolled',
          face_enrollment_date: new Date().toISOString(),
          face_images_count: capturedImages.length,
          face_quality_score: capturedImages.reduce((sum, img) => sum + img.quality_score, 0) / capturedImages.length
        })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Face enrolled with ${faceEmbeddings.length} embeddings`,
      });

      setShowFaceEnrollment(false);
      stopCamera();
      fetchStudents();
    } catch (error) {
      console.error('Error saving face embeddings:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save face embeddings",
      });
    }
  };

  const calculateAverageEmbedding = (embeddings: number[][]): number[] => {
    if (embeddings.length === 0) return [];
    if (embeddings.length === 1) return embeddings[0];

    const length = embeddings[0].length;
    const sum = new Array(length).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < length; i++) {
        sum[i] += embedding[i];
      }
    }

    return sum.map(val => val / embeddings.length);
  };

  const stopCamera = () => {
    stopAutoCapture();
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const getFaceStatusBadge = (status: string) => {
    switch (status) {
      case 'enrolled':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">🟢 Enrolled</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">🟡 Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">❌ Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500">🔴 Not Enrolled</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-gray-500">Inactive</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Student Management
          </h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total: <span className="font-semibold text-foreground">{students.length}</span>
            </p>
            <div className="h-4 w-px bg-border" />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Enrolled: <span className="font-semibold text-green-600">{students.filter(s => s.face_enrollment_status === 'enrolled').length}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowAddModal(true)} className="shadow-lg hover:shadow-xl transition-shadow">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
          <Button variant="outline" className="border-border/40">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button variant="outline" className="border-border/40">
            <Download className="h-4 w-4 mr-2" />
            Export List
          </Button>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Search & Filters</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  className="pl-10 border-border/40 bg-background/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="CSE">Computer Science</SelectItem>
                <SelectItem value="ECE">Electronics</SelectItem>
                <SelectItem value="ME">Mechanical</SelectItem>
                <SelectItem value="CE">Civil</SelectItem>
              </SelectContent>
            </Select>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="BTech">B.Tech</SelectItem>
                <SelectItem value="MTech">M.Tech</SelectItem>
                <SelectItem value="PhD">PhD</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="1">1st Year</SelectItem>
                <SelectItem value="2">2nd Year</SelectItem>
                <SelectItem value="3">3rd Year</SelectItem>
                <SelectItem value="4">4th Year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="A">Section A</SelectItem>
                <SelectItem value="B">Section B</SelectItem>
                <SelectItem value="C">Section C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Face Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_enrolled">Not Enrolled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="enrolled">Enrolled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List (Left Panel - 60%) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Student List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Enroll No</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Department/Program/Year</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Face Status</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">Loading students...</td>
                      </tr>
                    ) : filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr 
                          key={student.id} 
                          className={`border-b border-border hover:bg-muted/50 cursor-pointer ${
                            selectedStudent?.id === student.id ? 'bg-muted' : ''
                          }`}
                          onClick={() => setSelectedStudent(student)}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium">{student.name}</div>
                              <div className="text-sm text-muted-foreground">{student.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{student.enroll_no || student.username}</td>
                          <td className="px-4 py-3 text-sm">
                            <div>{student.department}</div>
                            <div className="text-xs text-muted-foreground">{student.program} - {student.year} - {student.section}</div>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(student.status)}</td>
                          <td className="px-4 py-3">{getFaceStatusBadge(student.face_enrollment_status)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startFaceEnrollment(student);
                                }}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No students found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Details & Face Enrollment (Right Panel - 40%) */}
        <div className="lg:col-span-1">
          {selectedStudent ? (
            <Card>
              <CardHeader>
                <CardTitle>Student Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">{selectedStudent.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                  <p className="text-sm text-muted-foreground">Enroll No: {selectedStudent.enroll_no || selectedStudent.username}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Department:</span>
                    <p>{selectedStudent.department}</p>
                  </div>
                  <div>
                    <span className="font-medium">Program:</span>
                    <p>{selectedStudent.program}</p>
                  </div>
                  <div>
                    <span className="font-medium">Year:</span>
                    <p>{selectedStudent.year}</p>
                  </div>
                  <div>
                    <span className="font-medium">Section:</span>
                    <p>{selectedStudent.section}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    {getStatusBadge(selectedStudent.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Face Status:</span>
                    {getFaceStatusBadge(selectedStudent.face_enrollment_status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Attendance Rate:</span>
                    <span className="text-sm">{selectedStudent.attendance_rate || 0}%</span>
                  </div>
                </div>

                <Button 
                  onClick={() => startFaceEnrollment(selectedStudent)}
                  className="w-full"
                  disabled={selectedStudent.face_enrollment_status === 'enrolled'}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {selectedStudent.face_enrollment_status === 'enrolled' ? 'Face Enrolled' : 'Start Face Enrollment'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Select a student to view details and manage face enrollment.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Face Enrollment Modal */}
      <Dialog open={showFaceEnrollment} onOpenChange={setShowFaceEnrollment}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Face Enrollment - {selectedStudent?.name}</DialogTitle>
            <DialogDescription>
              Capture multiple angles of the student's face for accurate recognition.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera Section */}
            <div className="space-y-4">
              <div className="relative">
                <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  {isCapturing ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Camera className="h-12 w-12" />
                    </div>
                  )}
                  
                  {/* Face detection overlay */}
                  {isCapturing && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-blue-500 rounded-full opacity-50"></div>
                    </div>
                  )}
                </div>
                
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Real-time feedback */}
              <div className="space-y-2">
                <h4 className="font-medium">Detection Status:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className={`flex items-center space-x-2 ${faceDetectionStatus.faceDetected ? 'text-green-600' : 'text-red-600'}`}>
                    {faceDetectionStatus.faceDetected ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>Face Detected</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${faceDetectionStatus.properLighting ? 'text-green-600' : 'text-red-600'}`}>
                    {faceDetectionStatus.properLighting ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>Proper Lighting</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${faceDetectionStatus.faceCentered ? 'text-green-600' : 'text-red-600'}`}>
                    {faceDetectionStatus.faceCentered ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>Face Centered</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${faceDetectionStatus.eyesVisible ? 'text-green-600' : 'text-red-600'}`}>
                    {faceDetectionStatus.eyesVisible ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>Eyes Visible</span>
                  </div>
                </div>
              </div>

              {/* Capture controls */}
              <div className="flex space-x-2">
                {!isAutoCapturing ? (
                  <Button 
                    onClick={startAutoCapture}
                    disabled={!isCapturing || !modelsLoaded}
                    className="flex-1"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Start Auto Capture (50 images)
                  </Button>
                ) : (
                  <Button 
                    onClick={stopAutoCapture}
                    variant="destructive"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Stop Capture ({capturedImages.length}/50)
                  </Button>
                )}
                <Button variant="outline" onClick={stopCamera}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Enrollment Progress</span>
                  <span>{capturedImages.length}/50 images • {enrollmentProgress}%</span>
                </div>
                <Progress value={enrollmentProgress} className="w-full" />
                {isAutoCapturing && (
                  <p className="text-xs text-blue-600 animate-pulse">
                    Automatically capturing faces... Keep your face centered and steady.
                  </p>
                )}
              </div>
            </div>

            {/* Guidelines and captured images */}
            <div className="space-y-4">
              {/* Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enrollment Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>Ensure good lighting and clear face visibility</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>Position face within the oval guide</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>Remove glasses or accessories if needed</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>Maintain neutral expression</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <span>Distance: 2-3 feet from camera</span>
                  </div>
                </CardContent>
              </Card>

              {/* Captured images preview */}
              {capturedImages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Captured Images Preview
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        (Last 6 of {capturedImages.length})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2">
                      {capturedImages.slice(-6).map((img, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={img.image} 
                            alt={`Capture ${capturedImages.length - 6 + index + 1}`}
                            className="w-full h-20 object-cover rounded"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                            {img.quality_score.toFixed(1)}/10
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFaceEnrollment(false);
              stopCamera();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={saveFaceEmbeddings}
              disabled={faceEmbeddings.length === 0 || isAutoCapturing}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Embeddings ({faceEmbeddings.length} embeddings)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter the student's information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="student@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll_no">Enrollment Number</Label>
              <Input id="enroll_no" placeholder="S12345" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CSE">Computer Science</SelectItem>
                    <SelectItem value="ECE">Electronics</SelectItem>
                    <SelectItem value="ME">Mechanical</SelectItem>
                    <SelectItem value="CE">Civil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="program">Program</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTech">B.Tech</SelectItem>
                    <SelectItem value="MTech">M.Tech</SelectItem>
                    <SelectItem value="PhD">PhD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1st Year</SelectItem>
                    <SelectItem value="2">2nd Year</SelectItem>
                    <SelectItem value="3">3rd Year</SelectItem>
                    <SelectItem value="4">4th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Section A</SelectItem>
                    <SelectItem value="B">Section B</SelectItem>
                    <SelectItem value="C">Section C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {/* Add student logic */}}>
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
