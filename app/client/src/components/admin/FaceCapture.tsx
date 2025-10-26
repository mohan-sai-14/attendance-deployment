import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, CameraOff, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectFaces, generateFaceEmbedding, validateFaceEmbedding, drawFaceBoundingBox } from '@/lib/faceRecognition';

interface FaceCaptureProps {
  studentId: string;
  studentName: string;
  onFaceCaptured: (embedding: number[], preview: string) => void;
  onCancel?: () => void;
}

export function FaceCapture({ studentId, studentName, onFaceCaptured, onCancel }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Draw face detection overlay
  useEffect(() => {
    if (isStreaming && videoRef.current && overlayCanvasRef.current) {
      const drawOverlay = async () => {
        try {
          const faces = await detectFaces(videoRef.current!);

          const overlayCanvas = overlayCanvasRef.current!;
          const overlayContext = overlayCanvas.getContext('2d');

          if (!overlayContext) return;

          // Clear previous drawings
          overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

          // Draw face bounding boxes
          faces.forEach((face) => {
            drawFaceBoundingBox(overlayCanvas, face.boundingBox, '#00ff00');
          });
        } catch (err) {
          // No face detected or other error - don't draw anything
        }

        // Continue drawing
        if (isStreaming) {
          requestAnimationFrame(drawOverlay);
        }
      };

      // Set overlay canvas dimensions
      if (videoRef.current) {
        overlayCanvasRef.current.width = videoRef.current.videoWidth;
        overlayCanvasRef.current.height = videoRef.current.videoHeight;
      }

      drawOverlay();
    }
  }, [isStreaming]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video metadata to load, then play
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
              setError('Failed to start video playback. Please try again.');
            });
            
            // Set overlay canvas dimensions once video is ready
            if (overlayCanvasRef.current) {
              overlayCanvasRef.current.width = videoRef.current.videoWidth;
              overlayCanvasRef.current.height = videoRef.current.videoHeight;
            }
          }
        };
        
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  const captureFace = useCallback(async () => {
    if (!videoRef.current) return;

    setIsCapturing(true);
    setError(null);

    try {
      // Generate face embedding from current video frame
      const embedding = await generateFaceEmbedding(videoRef.current);

      if (!validateFaceEmbedding(embedding)) {
        throw new Error('Invalid face embedding generated');
      }

      // Create preview image
      if (canvasRef.current && videoRef.current) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          context.drawImage(videoRef.current, 0, 0);

          const previewDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setCapturedImage(previewDataUrl);

          onFaceCaptured(embedding, previewDataUrl);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture face. Please try again.');
      console.error('Capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [onFaceCaptured]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setError(null);
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Face Capture - {studentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
          {!isStreaming && !capturedImage && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <CameraOff className="h-12 w-12 mx-auto mb-2" />
                <p>Click "Start Camera" to begin face capture</p>
              </div>
            </div>
          )}

          {isStreaming && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </>
          )}

          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
          )}

          <canvas
            ref={canvasRef}
            className="hidden"
          />
        </div>

        <div className="flex gap-2">
          {!isStreaming && !capturedImage && (
            <Button onClick={startCamera} className="flex-1">
              <Camera className="h-4 w-4 mr-2" />
              Start Camera
            </Button>
          )}

          {isStreaming && !capturedImage && (
            <>
              <Button onClick={captureFace} disabled={isCapturing} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                {isCapturing ? 'Capturing...' : 'Capture Face'}
              </Button>
              <Button onClick={stopCamera} variant="outline">
                <CameraOff className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}

          {capturedImage && (
            <>
              <Button onClick={retakePhoto} variant="outline" className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retake
              </Button>
              <Button onClick={startCamera} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                New Capture
              </Button>
            </>
          )}

          {onCancel && (
            <Button onClick={onCancel} variant="ghost">
              Cancel
            </Button>
          )}
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p>• Position your face in the center of the frame</p>
          <p>• Ensure good lighting on your face</p>
          <p>• Look directly at the camera</p>
          <p>• Remove glasses or hats if possible</p>
          <p>• Green box will appear when face is detected</p>
        </div>
      </CardContent>
    </Card>
  );
}
