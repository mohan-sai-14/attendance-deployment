/**
 * Face Detection and Recognition Utilities
 * This module provides functions for face detection, embedding generation, and matching
 */

// Mock face detection utilities
// In a real implementation, you would use face-api.js, MediaPipe, or similar

export interface FaceEmbedding {
  descriptor: number[];
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FaceMatchResult {
  isMatch: boolean;
  confidence: number;
  distance: number;
}

/**
 * Detect faces in an image
 */
export async function detectFaces(imageElement: HTMLImageElement | HTMLVideoElement): Promise<FaceEmbedding[]> {
  try {
    // Mock implementation - in reality, this would use face-api.js or similar
    console.log('Detecting faces in image...');

    // Simulate face detection
    const mockFaces: FaceEmbedding[] = [
      {
        descriptor: Array.from({ length: 128 }, () => Math.random()),
        confidence: 0.95,
        boundingBox: {
          x: 100,
          y: 80,
          width: 120,
          height: 150
        }
      }
    ];

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return mockFaces;
  } catch (error) {
    console.error('Face detection error:', error);
    throw new Error('Failed to detect faces');
  }
}

/**
 * Generate face embedding from detected face
 */
export async function generateFaceEmbedding(imageElement: HTMLImageElement | HTMLVideoElement): Promise<number[]> {
  try {
    const faces = await detectFaces(imageElement);

    if (faces.length === 0) {
      throw new Error('No face detected');
    }

    if (faces.length > 1) {
      throw new Error('Multiple faces detected. Please ensure only one face is visible.');
    }

    const face = faces[0];

    if (face.confidence < 0.8) {
      throw new Error('Face detection confidence too low. Please try again.');
    }

    return face.descriptor;
  } catch (error) {
    console.error('Face embedding generation error:', error);
    throw error;
  }
}

/**
 * Compare two face embeddings for similarity
 */
export function compareFaceEmbeddings(embedding1: number[], embedding2: number[]): FaceMatchResult {
  try {
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

    // Convert distance to confidence (lower distance = higher confidence)
    // This is a simplified approach - real implementations use more sophisticated metrics
    const maxDistance = Math.sqrt(embedding1.length); // Maximum possible distance
    const confidence = Math.max(0, 1 - (distance / maxDistance));

    // Threshold for considering it a match
    const threshold = 0.6;
    const isMatch = confidence >= threshold;

    return {
      isMatch,
      confidence,
      distance
    };
  } catch (error) {
    console.error('Face comparison error:', error);
    throw error;
  }
}

/**
 * Validate face embedding format and quality
 */
export function validateFaceEmbedding(embedding: number[]): boolean {
  try {
    if (!Array.isArray(embedding)) {
      return false;
    }

    if (embedding.length === 0) {
      return false;
    }

    // Check if all values are numbers between -1 and 1 (typical for face embeddings)
    return embedding.every(value =>
      typeof value === 'number' &&
      value >= -1 &&
      value <= 1 &&
      !isNaN(value)
    );
  } catch (error) {
    console.error('Embedding validation error:', error);
    return false;
  }
}

/**
 * Convert image element to blob for storage
 */
export async function imageToBlob(imageElement: HTMLImageElement | HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Handle different element types
    let width: number;
    let height: number;

    if (imageElement instanceof HTMLVideoElement) {
      width = imageElement.videoWidth;
      height = imageElement.videoHeight;
    } else if (imageElement instanceof HTMLImageElement) {
      width = imageElement.naturalWidth;
      height = imageElement.naturalHeight;
    } else {
      reject(new Error('Unsupported element type'));
      return;
    }

    // Ensure we have valid dimensions
    if (width === 0 || height === 0) {
      reject(new Error('Invalid image dimensions'));
      return;
    }

    canvas.width = width;
    canvas.height = height;

    context.drawImage(imageElement, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert image to blob'));
      }
    }, 'image/jpeg', 0.8);
  });
}

/**
 * Draw face bounding box on canvas
 */
export function drawFaceBoundingBox(
  canvas: HTMLCanvasElement,
  boundingBox: { x: number; y: number; width: number; height: number },
  color: string = '#00ff00'
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);

  // Add corner markers
  const markerSize = 8;
  context.fillStyle = color;

  // Top-left corner
  context.fillRect(boundingBox.x - markerSize/2, boundingBox.y - markerSize/2, markerSize, markerSize);

  // Top-right corner
  context.fillRect(
    boundingBox.x + boundingBox.width - markerSize/2,
    boundingBox.y - markerSize/2,
    markerSize,
    markerSize
  );

  // Bottom-left corner
  context.fillRect(
    boundingBox.x - markerSize/2,
    boundingBox.y + boundingBox.height - markerSize/2,
    markerSize,
    markerSize
  );

  // Bottom-right corner
  context.fillRect(
    boundingBox.x + boundingBox.width - markerSize/2,
    boundingBox.y + boundingBox.height - markerSize/2,
    markerSize,
    markerSize
  );
}
