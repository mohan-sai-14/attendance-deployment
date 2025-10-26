import React, { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';
import { Button, Card, Progress, message, Upload, UploadProps, Space, Typography } from 'antd';
import { UploadOutlined, CameraOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';

const { Title, Text } = Typography;

interface FaceEnrollmentProps {
  studentId: string;
  rollNumber: string;
  onComplete?: () => void;
}

const FaceEnrollment: React.FC<FaceEnrollmentProps> = ({ studentId, rollNumber, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureInterval = useRef<NodeJS.Timeout | null>(null);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        console.log('Face detection models loaded');
      } catch (error) {
        console.error('Failed to load face detection models:', error);
        message.error('Failed to load face detection models');
      } finally {
        setIsModelLoading(false);
      }
    };

    loadModels();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video metadata to load, then play
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
              message.error('Failed to start video playback. Please try again.');
            });
          }
        };
        
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      message.error('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
      captureInterval.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsCameraActive(false);
    setCaptureCount(0);
  };

  const startCapture = () => {
    if (captureInterval.current) return;
    
    setEmbeddings([]);
    setCaptureCount(0);
    
    captureInterval.current = setInterval(async () => {
      if (captureCount >= 50) {
        stopCapture();
        return;
      }
      
      try {
        const faceDescriptor = await captureFace();
        if (faceDescriptor) {
          setEmbeddings(prev => [...prev, Array.from(faceDescriptor.descriptor) as number[]]);
          setCaptureCount(prev => prev + 1);
          setProgress(Math.min(100, Math.round(((captureCount + 1) / 50) * 100)));
        }
      } catch (error) {
        console.error('Error capturing face:', error);
      }
    }, 300); // Capture every 300ms
  };

  const stopCapture = () => {
    if (captureInterval.current) {
      clearInterval(captureInterval.current);
      captureInterval.current = null;
    }
  };

  const captureFace = async (): Promise<faceapi.FaceDescriptor | null> => {
    if (!videoRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!canvas) return null;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
    
    // Detect all faces in the video
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    if (detections.length === 0) {
      message.warning('No face detected. Please position your face in the frame.');
      return null;
    }
    
    // Get the largest face
    const largestFace = detections.reduce((prev, current) => {
      const prevSize = prev.detection.box.width * prev.detection.box.height;
      const currentSize = current.detection.box.width * current.detection.box.height;
      return currentSize > prevSize ? current : prev;
    });
    
    return largestFace.descriptor ? largestFace : null;
  };

  const handleFileUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    try {
      setIsLoading(true);
      setEmbeddings([]);
      
      const image = await faceapi.bufferToImage(file as File);
      const detections = await faceapi
        .detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      if (detections.length === 0) {
        throw new Error('No face detected in the uploaded image');
      }
      
      // Get the largest face
      const largestFace = detections.reduce((prev, current) => {
        const prevSize = prev.detection.box.width * prev.detection.box.height;
        const currentSize = current.detection.box.width * current.detection.box.height;
        return currentSize > prevSize ? current : prev;
      });
      
      setEmbeddings([Array.from(largestFace.descriptor) as number[]]);
      setCaptureCount(1);
      setProgress(100);
      onSuccess?.('success', null as any);
      message.success('Face detected in the uploaded image');
    } catch (error) {
      console.error('Error processing uploaded image:', error);
      onError?.(new Error('Failed to process image'));
      message.error('Failed to process image. Please make sure it contains a clear face.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveFaceData = async () => {
    if (embeddings.length === 0) {
      message.warning('No face data to save');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Calculate average embedding
      const avgEmbedding = calculateAverageEmbedding(embeddings);
      
      // Save to Supabase
      const { data, error } = await supabase.rpc('upsert_student_face', {
        p_student_id: studentId,
        p_roll_number: rollNumber,
        p_face_embedding: avgEmbedding
      });
      
      if (error) throw error;
      
      message.success('Face data saved successfully');
      onComplete?.();
    } catch (error) {
      console.error('Error saving face data:', error);
      message.error('Failed to save face data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAverageEmbedding = (embeddings: number[][]) => {
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

  return (
    <Card 
      title="Face Enrollment" 
      loading={isModelLoading}
      style={{ maxWidth: 800, margin: '0 auto' }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text>
          Capture multiple images of the student's face from different angles to improve recognition accuracy.
        </Text>
      </div>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', width: 640, height: 480, border: '1px solid #d9d9d9' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ 
                width: '100%', 
                height: '100%',
                display: isCameraActive ? 'block' : 'none',
                objectFit: 'cover'
              }}
            />
            {!isCameraActive && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '100%',
                background: '#f0f0f0'
              }}>
                <Text type="secondary">Camera feed will appear here</Text>
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }} 
            />
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <Progress percent={progress} status={progress < 100 ? 'active' : 'success'} />
          <Text type="secondary">
            {captureCount} / 50 images captured
          </Text>
        </div>
        
        <Space wrap>
          {!isCameraActive ? (
            <Button 
              type="primary" 
              icon={<CameraOutlined />} 
              onClick={startCamera}
              disabled={isModelLoading}
            >
              Start Camera
            </Button>
          ) : (
            <>
              <Button 
                type="primary" 
                onClick={startCapture}
                disabled={captureCount >= 50 || captureInterval.current !== null}
              >
                Start Capture
              </Button>
              <Button 
                onClick={stopCapture}
                disabled={captureInterval.current === null}
              >
                Stop Capture
              </Button>
              <Button onClick={stopCamera}>
                Close Camera
              </Button>
            </>
          )}
          
          <Upload
            accept="image/*"
            showUploadList={false}
            customRequest={handleFileUpload as any}
            disabled={isModelLoading || isCameraActive}
          >
            <Button icon={<UploadOutlined />}>
              Upload Photo
            </Button>
          </Upload>
          
          <Button 
            type="primary" 
            onClick={saveFaceData}
            disabled={captureCount === 0 || isLoading}
            loading={isLoading}
          >
            Save Face Data
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

export default FaceEnrollment;
