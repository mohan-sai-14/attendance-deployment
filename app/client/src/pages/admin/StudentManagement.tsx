import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from "framer-motion";
import * as faceapi from 'face-api.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import { useToast } from "@/hooks/use-toast";
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
  batch: string;
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

  const [searchParams] = useSearchParams();

  // Search and filters
  const [mainTab, setMainTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get("department") || "all");
  const [programFilter, setProgramFilter] = useState(searchParams.get("program") || "all");
  const [yearFilter, setYearFilter] = useState(searchParams.get("year") || "all");
  const [sectionFilter, setSectionFilter] = useState(searchParams.get("section") || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classSortFilter, setClassSortFilter] = useState("all");

  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudentData, setEditStudentData] = useState<any>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);

  // Keep filters updated if searchParams change without a full remount
  useEffect(() => {
    const dept = searchParams.get("department");
    if (dept) setDepartmentFilter(dept);
    const prog = searchParams.get("program");
    if (prog) setProgramFilter(prog);
    const yr = searchParams.get("year");
    if (yr) setYearFilter(yr);
    const sec = searchParams.get("section");
    if (sec) setSectionFilter(sec);

    if (dept && prog && yr && sec) {
      setClassSortFilter(dept + prog + yr + sec);
    }
  }, [searchParams]);

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

  const [addStudentFormData, setAddStudentFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    enroll_no: '',
    registered_no: ''
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

  // Fetch available classes
  useEffect(() => {
    const fetchClasses = async () => {
      const { data, error } = await supabase.from('classes').select('*');
      if (!error && data) setAvailableClasses(data);
    };
    fetchClasses();
  }, []);

  // Fetch students data
  useEffect(() => {
    fetchStudents();
  }, []);

  // Filter students based on search and filters
  useEffect(() => {
    let filtered = students.filter(student => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        (student.name || '').toLowerCase().includes(q) ||
        (student.username || '').toLowerCase().includes(q) ||
        String(student.enroll_no || '').toLowerCase().includes(q) ||
        String(student.registered_no || '').toLowerCase().includes(q) ||
        (student.email || '').toLowerCase().includes(q);

      const matchesClassSort = classSortFilter === "all" || (
        student.department + student.program + student.year + student.section === classSortFilter
      );

      const matchesDepartment = departmentFilter === "all" || student.department === departmentFilter;
      const matchesProgram = programFilter === "all" || student.program === programFilter;
      const matchesYear = yearFilter === "all" || student.year === yearFilter;
      const matchesSection = sectionFilter === "all" || student.section === sectionFilter;
      const matchesStatus = statusFilter === "all" || student.face_enrollment_status === statusFilter;
      const matchesMainTab = mainTab === "all" ||
        (mainTab === "active" && student.status === "active") ||
        (mainTab === "inactive" && student.status !== "active") ||
        (mainTab === "face_pending" && student.face_enrollment_status === "pending");

      return matchesSearch && matchesDepartment && matchesProgram && matchesYear && matchesSection && matchesStatus && matchesClassSort && matchesMainTab;
    });

    setFilteredStudents(filtered);
  }, [students, searchQuery, departmentFilter, programFilter, yearFilter, sectionFilter, statusFilter, classSortFilter, mainTab]);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'student')
        .order('name', { ascending: true });

      if (error) throw error;

      const studentsWithDefaults = (data || []).map(student => ({
        ...student,
        attendance_rate: 0,
        face_enrollment_status: student.face_enrollment_status || 'not_enrolled',
        face_images_count: student.face_images_count || 0,
        face_quality_score: student.face_quality_score || 0
      }));

      setStudents(studentsWithDefaults);
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

  const handleAddStudent = async () => {
    try {
      // Basic validation
      if (!addStudentFormData.username || !addStudentFormData.password || !addStudentFormData.name || !addStudentFormData.email) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please fill in all required fields (Username, Password, Name, Email)",
        });
        return;
      }

      let dept = departmentFilter;
      let prog = programFilter;
      let yr = yearFilter;
      let sec = sectionFilter;

      if (classSortFilter !== 'all') {
        const selectedClass = availableClasses.find(c => (c.department + c.program + c.year + c.section) === classSortFilter);
        if (selectedClass) {
          dept = selectedClass.department;
          prog = selectedClass.program;
          yr = selectedClass.year;
          sec = selectedClass.section;
        }
      }

      const { error } = await supabase
        .from('users')
        .insert([{
          ...addStudentFormData,
          role: 'student',
          status: 'active',
          department: dept !== 'all' ? dept : null,
          program: prog !== 'all' ? prog : null,
          year: yr !== 'all' ? yr : null,
          section: sec !== 'all' ? sec : null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student added successfully",
      });

      setShowAddModal(false);
      setAddStudentFormData({
        username: '',
        password: '',
        name: '',
        email: '',
        enroll_no: '',
        registered_no: ''
      });
      fetchStudents();
    } catch (error: any) {
      console.error("Error adding student:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add student",
      });
    }
  };

  const handleUpdateStudent = async () => {
    if (!editStudentData) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editStudentData.name,
          email: editStudentData.email,
          enroll_no: editStudentData.enroll_no,
          registered_no: editStudentData.registered_no,
          password: editStudentData.password // Note: In production, password should be hashed
        })
        .eq('id', editStudentData.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Student updated successfully",
      });
      setShowEditModal(false);
      fetchStudents();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Error",
        description: error.message,
      });
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0"
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
          <Button onClick={() => setShowAddModal(true)} className="shadow-lg hover:shadow-xl transition-shadow bg-primary text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="shrink-0 mt-6"
      >
        <Card className="border-border/40 bg-gradient-to-br from-background via-background to-background/50 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Search & Class Filters</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Search Students</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, Username, Enroll No..."
                    className="pl-10 border-border/40 bg-background/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Sort by Class</Label>
                <Select value={classSortFilter} onValueChange={setClassSortFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {availableClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.department + cls.program + cls.year + cls.section}>
                        {cls.department} - {cls.program} ({cls.year} Yr, Sec {cls.section})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Year Filter</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="1ST">1ST Year</SelectItem>
                    <SelectItem value="2ND">2ND Year</SelectItem>
                    <SelectItem value="3RD">3RD Year</SelectItem>
                    <SelectItem value="4TH">4TH Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Area - Card Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 mt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {filteredStudents.map((student) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                layout
              >
                <Card 
                  className={`h-full flex flex-col cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 overflow-hidden ${
                    student.status === 'inactive' ? 'border-red-500/30' : 
                    student.face_enrollment_status === 'pending' ? 'border-yellow-500/30' : ''
                  }`}
                  onClick={() => setSelectedStudent(student)}
                >
                  <CardContent className="p-5 flex flex-col items-center text-center gap-3 flex-grow">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold bg-muted/50 text-muted-foreground ring-2 ring-background">
                        {(student.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-1 -right-1">
                        {student.status === 'active' ? (
                          <div className="h-4 w-4 rounded-full border-2 border-background bg-emerald-500" title="Active" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-background bg-red-400" title="Inactive" />
                        )}
                      </div>
                    </div>
                    
                    <div className="w-full space-y-1">
                      <h3 className="font-semibold text-foreground truncate" title={student.name}>{student.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{student.enroll_no || student.username}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {student.department} · {student.year} Yr (Sec {student.section})
                      </p>
                    </div>
                    
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5 align-baseline">
                      {getFaceStatusBadge(student.face_enrollment_status)}
                      {student.status === 'inactive' && (
                        <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 px-1.5 py-0">Inactive</Badge>
                      )}
                    </div>
                  </CardContent>
                  
                  <div className="bg-muted/10 p-2 flex justify-center gap-2 border-t mt-auto">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); startFaceEnrollment(student); }} 
                      className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      title="Face Enrollment"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setEditStudentData(student); setShowEditModal(true); }} 
                      className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                      title="Edit Student"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setDeleteStudent(student); }} 
                      className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete Student"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center h-full">
            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground">No students found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              We couldn't find any students matching your current search and filters.
            </p>
          </div>
        )}
      </div>

      {/* Student Details Sheet (Drawer) */}
      <Sheet open={!!selectedStudent} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l shadow-2xl">
          {selectedStudent && (
            <div className="py-6 space-y-8">
              <SheetHeader className="text-left space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold bg-primary/10 text-primary ring-4 ring-primary/5">
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-2xl">{selectedStudent.name}</SheetTitle>
                    <div className="text-sm font-medium text-muted-foreground mt-1">
                      {selectedStudent.enroll_no || selectedStudent.username}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {getStatusBadge(selectedStudent.status)}
                  {getFaceStatusBadge(selectedStudent.face_enrollment_status)}
                </div>
              </SheetHeader>

              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academic Profile</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <Label className="text-[10px] text-muted-foreground uppercase">Department</Label>
                      <p className="font-semibold text-sm mt-0.5">{selectedStudent.department}</p>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <Label className="text-[10px] text-muted-foreground uppercase">Program</Label>
                      <p className="font-semibold text-sm mt-0.5">{selectedStudent.program}</p>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <Label className="text-[10px] text-muted-foreground uppercase">Year / Section</Label>
                      <p className="font-semibold text-sm mt-0.5">{selectedStudent.year} Yr / Sec {selectedStudent.section}</p>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                      <Label className="text-[10px] text-muted-foreground uppercase">Batch</Label>
                      <p className="font-semibold text-sm mt-0.5">{selectedStudent.batch}</p>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50 col-span-2">
                      <Label className="text-[10px] text-muted-foreground uppercase">Registered Number</Label>
                      <p className="font-semibold text-sm mt-0.5">{selectedStudent.registered_no || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact & System</h3>
                  <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Email Address</Label>
                      <p className="font-medium text-sm mt-0.5">{selectedStudent.email}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Attendance Rate</Label>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={selectedStudent.attendance_rate || 0} className="h-2 flex-1" />
                        <span className="text-sm font-semibold">{selectedStudent.attendance_rate || 0}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Face Recognition</h3>
                  </div>
                  
                  <Card className={`border ${selectedStudent.face_enrollment_status === 'enrolled' ? 'border-green-500/20 bg-green-50/50 dark:bg-green-950/20' : 'border-border bg-muted/20'}`}>
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={`mt-0.5 h-10 w-10 rounded-full flex items-center justify-center ${selectedStudent.face_enrollment_status === 'enrolled' ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {selectedStudent.face_enrollment_status === 'enrolled' ? <Camera className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">
                          {selectedStudent.face_enrollment_status === 'enrolled' ? 'Active Profile' : 'Pending Enrollment'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedStudent.face_enrollment_status === 'enrolled' 
                            ? `Quality score: ${Math.round(selectedStudent.face_quality_score || 85)}%` 
                            : 'Face data is required for QR attendance system.'}
                        </p>
                        
                        <Button 
                          size="sm" 
                          variant={selectedStudent.face_enrollment_status === 'enrolled' ? 'outline' : 'default'}
                          className="mt-3 w-full"
                          onClick={() => {
                            setSelectedStudent(null);
                            startFaceEnrollment(selectedStudent);
                          }}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          {selectedStudent.face_enrollment_status === 'enrolled' ? 'Update Face Data' : 'Start Enrollment'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
      </Dialog >

      {/* Add Student Modal */}
      < Dialog open={showAddModal} onOpenChange={setShowAddModal} >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Adding student to: {departmentFilter !== 'all' ? departmentFilter : 'N/A'} - {programFilter !== 'all' ? programFilter : 'N/A'} ({yearFilter !== 'all' ? yearFilter : 'N/A'} Year, Section {sectionFilter !== 'all' ? sectionFilter : 'N/A'})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">Username</Label>
              <Input
                id="username"
                className="col-span-3"
                value={addStudentFormData.username}
                onChange={(e) => setAddStudentFormData({ ...addStudentFormData, username: e.target.value })}
                placeholder="e.g. john_doe"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">Password</Label>
              <Input
                id="password"
                type="password"
                className="col-span-3"
                value={addStudentFormData.password}
                onChange={(e) => setAddStudentFormData({ ...addStudentFormData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Full Name</Label>
              <Input
                id="name"
                className="col-span-3"
                value={addStudentFormData.name}
                onChange={(e) => setAddStudentFormData({ ...addStudentFormData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input
                id="email"
                type="email"
                className="col-span-3"
                value={addStudentFormData.email}
                onChange={(e) => setAddStudentFormData({ ...addStudentFormData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="enroll_no" className="text-right">Enroll No</Label>
              <Input
                id="enroll_no"
                className="col-span-3"
                value={addStudentFormData.enroll_no}
                onChange={(e) => setAddStudentFormData({ ...addStudentFormData, enroll_no: e.target.value })}
                placeholder="ENR12345"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="registered_no" className="text-right">Reg. No</Label>
              <Input
                id="registered_no"
                className="col-span-3"
                value={addStudentFormData.registered_no}
                onChange={(e) => setAddStudentFormData({ ...addStudentFormData, registered_no: e.target.value })}
                placeholder="REG67890"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStudent}>
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Edit Student Modal */}
      < Dialog open={showEditModal} onOpenChange={setShowEditModal} >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Student Details</DialogTitle>
            <DialogDescription>
              Update information for {editStudentData?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Full Name</Label>
              <Input
                className="col-span-3"
                value={editStudentData?.name || ''}
                onChange={(e) => setEditStudentData({ ...editStudentData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Email</Label>
              <Input
                className="col-span-3"
                value={editStudentData?.email || ''}
                onChange={(e) => setEditStudentData({ ...editStudentData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Enroll No</Label>
              <Input
                className="col-span-3"
                value={editStudentData?.enroll_no || ''}
                onChange={(e) => setEditStudentData({ ...editStudentData, enroll_no: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Reg. No</Label>
              <Input
                className="col-span-3"
                value={editStudentData?.registered_no || ''}
                onChange={(e) => setEditStudentData({ ...editStudentData, registered_no: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Password</Label>
              <Input
                type="password"
                className="col-span-3"
                value={editStudentData?.password || ''}
                onChange={(e) => setEditStudentData({ ...editStudentData, password: e.target.value })}
                placeholder="Leave blank to keep current"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdateStudent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteStudent} onOpenChange={(open) => { if (!open) setDeleteStudent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteStudent?.name || deleteStudent?.username}</strong>? This action cannot be undone and will permanently remove the student record from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStudent(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteStudent) return;
                try {
                  const { error } = await supabase
                    .from('users')
                    .delete()
                    .eq('id', deleteStudent.id);
                  if (error) throw error;
                  toast({ title: 'Student Deleted', description: `${deleteStudent.name || deleteStudent.username} has been removed.` });
                  if (selectedStudent?.id === deleteStudent.id) setSelectedStudent(null);
                  setDeleteStudent(null);
                  fetchStudents();
                } catch (error: any) {
                  toast({ variant: 'destructive', title: 'Delete Failed', description: error.message || 'Could not delete student.' });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
