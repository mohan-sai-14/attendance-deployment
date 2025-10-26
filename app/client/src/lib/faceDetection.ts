// Face Detection and Recognition Utilities
import * as faceapi from 'face-api.js';

export interface FaceDetectionResult {
  faceDetected: boolean;
  properLighting: boolean;
  faceCentered: boolean;
  eyesVisible: boolean;
  multipleFaces: boolean;
  confidence: number;
  landmarks?: any[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FaceCaptureResult {
  image: string;
  quality_score: number;
  confidence: number;
  landmarks: any[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  embedding?: number[];
}

class FaceDetectionService {
  private modelsLoaded = false;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load face-api.js models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models')
      ]);
      
      this.modelsLoaded = true;
      this.isInitialized = true;
      console.log('Face detection models loaded successfully');
    } catch (error) {
      console.error('Failed to load face detection models:', error);
      throw new Error('Face detection models could not be loaded');
    }
  }

  async detectFace(videoElement: HTMLVideoElement): Promise<FaceDetectionResult> {
    if (!this.modelsLoaded) {
      await this.initialize();
    }

    try {
      const detections = await faceapi
        .detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detections.length === 0) {
        return {
          faceDetected: false,
          properLighting: false,
          faceCentered: false,
          eyesVisible: false,
          multipleFaces: false,
          confidence: 0
        };
      }

      const face = detections[0];
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      // Calculate face position relative to video center
      const faceCenterX = face.detection.box.x + face.detection.box.width / 2;
      const faceCenterY = face.detection.box.y + face.detection.box.height / 2;
      const videoCenterX = videoWidth / 2;
      const videoCenterY = videoHeight / 2;
      
      const distanceFromCenter = Math.sqrt(
        Math.pow(faceCenterX - videoCenterX, 2) + Math.pow(faceCenterY - videoCenterY, 2)
      );
      
      // Calculate face size relative to video
      const faceArea = face.detection.box.width * face.detection.box.height;
      const videoArea = videoWidth * videoHeight;
      const faceSizeRatio = faceArea / videoArea;
      
      // Check if eyes are visible (simplified check)
      const landmarks = face.landmarks;
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const eyesVisible = leftEye.length > 0 && rightEye.length > 0;
      
      // Estimate lighting quality based on face detection confidence
      const properLighting = face.detection.score > 0.7;
      
      // Check if face is centered (within 20% of center)
      const faceCentered = distanceFromCenter < (videoWidth * 0.2);
      
      // Check if face size is appropriate (between 5% and 25% of video area)
      const appropriateSize = faceSizeRatio > 0.05 && faceSizeRatio < 0.25;
      
      return {
        faceDetected: true,
        properLighting,
        faceCentered: faceCentered && appropriateSize,
        eyesVisible,
        multipleFaces: detections.length > 1,
        confidence: face.detection.score,
        landmarks: landmarks.positions,
        boundingBox: {
          x: face.detection.box.x,
          y: face.detection.box.y,
          width: face.detection.box.width,
          height: face.detection.box.height
        }
      };
    } catch (error) {
      console.error('Face detection error:', error);
      return {
        faceDetected: false,
        properLighting: false,
        faceCentered: false,
        eyesVisible: false,
        multipleFaces: false,
        confidence: 0
      };
    }
  }

  async captureFace(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<FaceCaptureResult> {
    if (!this.modelsLoaded) {
      await this.initialize();
    }

    try {
      // Draw video frame to canvas
      const canvas = canvasElement;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not get canvas context');

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      context.drawImage(videoElement, 0, 0);

      // Detect face in the captured frame
      const detections = await faceapi
        .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        throw new Error('No face detected in captured image');
      }

      if (detections.length > 1) {
        throw new Error('Multiple faces detected. Please ensure only one face is visible.');
      }

      const face = detections[0];
      
      // Calculate quality score based on various factors
      const qualityScore = this.calculateQualityScore(face);
      
      // Convert canvas to image data
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      return {
        image: imageData,
        quality_score: qualityScore,
        confidence: face.detection.score,
        landmarks: face.landmarks.positions,
        boundingBox: {
          x: face.detection.box.x,
          y: face.detection.box.y,
          width: face.detection.box.width,
          height: face.detection.box.height
        },
        embedding: Array.from(face.descriptor)
      };
    } catch (error) {
      console.error('Face capture error:', error);
      throw error;
    }
  }

  private calculateQualityScore(face: any): number {
    let score = 0;
    
    // Base score from detection confidence
    score += face.detection.score * 4; // 0-4 points
    
    // Face size score (optimal size gets full points)
    const faceArea = face.detection.box.width * face.detection.box.height;
    const optimalSize = 150 * 150; // Optimal face size in pixels
    const sizeRatio = Math.min(faceArea / optimalSize, optimalSize / faceArea);
    score += sizeRatio * 2; // 0-2 points
    
    // Landmarks quality score
    const landmarks = face.landmarks.positions;
    if (landmarks && landmarks.length > 0) {
      score += 2; // 2 points for having landmarks
      
      // Check if key facial features are present
      const hasEyes = this.checkFacialFeature(landmarks, 'eyes');
      const hasNose = this.checkFacialFeature(landmarks, 'nose');
      const hasMouth = this.checkFacialFeature(landmarks, 'mouth');
      
      if (hasEyes) score += 1;
      if (hasNose) score += 0.5;
      if (hasMouth) score += 0.5;
    }
    
    // Cap the score at 10
    return Math.min(score, 10);
  }

  private checkFacialFeature(landmarks: any[], feature: string): boolean {
    // Simplified check for facial features
    // In a real implementation, you would check specific landmark points
    return landmarks.length > 0;
  }

  async generateFaceEmbedding(imageData: string): Promise<number[]> {
    if (!this.modelsLoaded) {
      await this.initialize();
    }

    try {
      // Create image element from data URL
      const img = new Image();
      img.src = imageData;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Detect face and generate embedding
      const detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceDescriptors();

      if (detections.length === 0) {
        throw new Error('No face detected in image');
      }

      if (detections.length > 1) {
        throw new Error('Multiple faces detected');
      }

      return Array.from(detections[0].descriptor);
    } catch (error) {
      console.error('Face embedding generation error:', error);
      throw error;
    }
  }

  async compareFaces(embedding1: number[], embedding2: number[]): Promise<number> {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions do not match');
    }

    // Calculate Euclidean distance
    let distance = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      distance += diff * diff;
    }
    distance = Math.sqrt(distance);

    // Convert distance to similarity score (0-1, where 1 is identical)
    const maxDistance = Math.sqrt(embedding1.length);
    const similarity = Math.max(0, 1 - (distance / maxDistance));
    
    return similarity;
  }

  // Utility function to validate face embedding
  validateFaceEmbedding(embedding: number[]): boolean {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return false;
    }

    // Check if all values are numbers and within expected range
    return embedding.every(value => 
      typeof value === 'number' && 
      !isNaN(value) && 
      value >= -1 && 
      value <= 1
    );
  }

  // Utility function to get face detection status message
  getStatusMessage(result: FaceDetectionResult): string {
    if (!result.faceDetected) {
      return "No face detected. Please position your face in front of the camera.";
    }
    
    if (result.multipleFaces) {
      return "Multiple faces detected. Please ensure only one person is visible.";
    }
    
    if (!result.properLighting) {
      return "Poor lighting detected. Please improve the lighting conditions.";
    }
    
    if (!result.faceCentered) {
      return "Please center your face within the oval guide.";
    }
    
    if (!result.eyesVisible) {
      return "Eyes not clearly visible. Please remove glasses or adjust position.";
    }
    
    return "Perfect! Face is ready for capture.";
  }
}

// Export singleton instance
export const faceDetectionService = new FaceDetectionService();

// Export utility functions
export const {
  detectFace,
  captureFace,
  generateFaceEmbedding,
  compareFaces,
  validateFaceEmbedding,
  getStatusMessage
} = faceDetectionService;
