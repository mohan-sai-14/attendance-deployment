/**
 * Liveness Detection Utility
 * Uses face-api.js 68-point landmarks to detect blinks and head turns
 * to prevent photo-based face verification spoofing.
 */
import * as faceapi from 'face-api.js';

// Eye landmark indices (from the 68-point model)
// Left eye: points 36-41
// Right eye: points 42-47
const LEFT_EYE = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE = [42, 43, 44, 45, 46, 47];
const NOSE_TIP = 30;

/**
 * Detect head turn direction based on nose position relative to face boundaries
 * @returns { direction, amount } where direction is 'left' | 'right' | 'up' | 'down' | 'center'
 */
export function getHeadMovement(landmarks: faceapi.FaceLandmarks68): {
  direction: 'left' | 'right' | 'up' | 'down' | 'center';
  amount: number;
} {
  const noseTip = landmarks.positions[NOSE_TIP];
  
  // Jaw endpoints for horizontal (yaw)
  const jawLeft = landmarks.positions[0];
  const jawRight = landmarks.positions[16];
  const faceWidth = jawRight.x - jawLeft.x;
  const faceCenterX = (jawLeft.x + jawRight.x) / 2;
  
  // Nose bridge to Chin for vertical (pitch)
  const noseBridge = landmarks.positions[27];
  const chin = landmarks.positions[8];
  const faceHeight = chin.y - noseBridge.y;
  const faceCenterY = (noseBridge.y + chin.y) / 2;
  
  if (faceWidth === 0 || faceHeight === 0) return { direction: 'center', amount: 0 };
  
  // Horizontal offset
  const offsetX = (noseTip.x - faceCenterX) / (faceWidth / 2);
  // Vertical offset
  const offsetY = (noseTip.y - faceCenterY) / (faceHeight / 2);
  
  const HORIZ_THRESHOLD = 0.20;
  const VERT_THRESHOLD = 0.15;
  
  // Prioritize the larger movement
  if (Math.abs(offsetX) > Math.abs(offsetY) * 1.5) {
    if (offsetX < -HORIZ_THRESHOLD) return { direction: 'left', amount: Math.abs(offsetX) };
    if (offsetX > HORIZ_THRESHOLD) return { direction: 'right', amount: Math.abs(offsetX) };
  } else {
    if (offsetY < -VERT_THRESHOLD) return { direction: 'up', amount: Math.abs(offsetY) };
    if (offsetY > VERT_THRESHOLD) return { direction: 'down', amount: Math.abs(offsetY) };
  }
  
  return { direction: 'center', amount: 0 };
}

/**
 * Liveness challenge types
 */
export type ChallengeType = 'turn_left' | 'turn_right' | 'turn_up' | 'turn_down';

export interface LivenessChallenge {
  type: ChallengeType;
  instruction: string;
  completed: boolean;
}

/**
 * Generate a random sequence of head turn challenges
 */
export function generateChallenges(): LivenessChallenge[] {
  const types: ChallengeType[] = ['turn_left', 'turn_right', 'turn_up', 'turn_down'];
  
  // Pick two random unique directions
  const shuffled = [...types].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 2);
  
  const instructions: Record<ChallengeType, string> = {
    'turn_left': 'Turn your head left',
    'turn_right': 'Turn your head right',
    'turn_up': 'Look up',
    'turn_down': 'Look down'
  };
  
  return selected.map(type => ({
    type,
    instruction: instructions[type],
    completed: false
  }));
}


