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
 * Calculate Eye Aspect Ratio (EAR) for blink detection
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * When eye is open, EAR is ~0.25-0.30
 * When eye is closed/blinking, EAR drops below ~0.20
 */
function euclideanDist(p1: faceapi.Point, p2: faceapi.Point): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function eyeAspectRatio(landmarks: faceapi.FaceLandmarks68, eyeIndices: number[]): number {
  const pts = eyeIndices.map(i => landmarks.positions[i]);
  // Vertical distances
  const v1 = euclideanDist(pts[1], pts[5]);
  const v2 = euclideanDist(pts[2], pts[4]);
  // Horizontal distance
  const h = euclideanDist(pts[0], pts[3]);
  
  if (h === 0) return 0;
  return (v1 + v2) / (2 * h);
}

/**
 * Detect if a blink occurred by checking the Eye Aspect Ratio
 * @returns EAR value (lower = more closed)
 */
export function getEAR(landmarks: faceapi.FaceLandmarks68): number {
  const leftEAR = eyeAspectRatio(landmarks, LEFT_EYE);
  const rightEAR = eyeAspectRatio(landmarks, RIGHT_EYE);
  return (leftEAR + rightEAR) / 2;
}

/**
 * Detect head turn direction based on nose position relative to face center
 * @returns { direction, amount } where direction is 'left' | 'right' | 'center'
 *          and amount is 0-1 (0 = center, 1 = extreme turn)
 */
export function getHeadTurn(landmarks: faceapi.FaceLandmarks68): {
  direction: 'left' | 'right' | 'center';
  amount: number;
} {
  const noseTip = landmarks.positions[NOSE_TIP];
  
  // Use jaw endpoints to determine face width and center
  const jawLeft = landmarks.positions[0];   // leftmost jaw point
  const jawRight = landmarks.positions[16]; // rightmost jaw point
  
  const faceWidth = jawRight.x - jawLeft.x;
  const faceCenter = (jawLeft.x + jawRight.x) / 2;
  
  if (faceWidth === 0) return { direction: 'center', amount: 0 };
  
  // Calculate how far the nose is from center as a ratio
  const offset = (noseTip.x - faceCenter) / (faceWidth / 2);
  
  // Thresholds: < -0.15 = turned left, > 0.15 = turned right
  const TURN_THRESHOLD = 0.15;
  
  if (offset < -TURN_THRESHOLD) {
    return { direction: 'left', amount: Math.min(Math.abs(offset), 1) };
  } else if (offset > TURN_THRESHOLD) {
    return { direction: 'right', amount: Math.min(Math.abs(offset), 1) };
  }
  
  return { direction: 'center', amount: Math.abs(offset) };
}

/**
 * Liveness challenge types
 */
export type ChallengeType = 'blink' | 'turn_left' | 'turn_right';

export interface LivenessChallenge {
  type: ChallengeType;
  instruction: string;
  completed: boolean;
}

/**
 * Generate a random sequence of liveness challenges
 */
export function generateChallenges(): LivenessChallenge[] {
  // Always blink first (easiest), then a random head turn
  const turnDirection = Math.random() > 0.5 ? 'turn_left' : 'turn_right';
  
  return [
    {
      type: 'blink',
      instruction: 'Please blink your eyes',
      completed: false,
    },
    {
      type: turnDirection,
      instruction: turnDirection === 'turn_left' ? 'Turn your head to the left' : 'Turn your head to the right',
      completed: false,
    },
  ];
}

// EAR thresholds
export const EAR_BLINK_THRESHOLD = 0.23; // Below this = eyes closed/blinking
export const EAR_OPEN_THRESHOLD = 0.25;  // Above this = eyes open (for detecting blink end)

// Head turn thresholds
export const HEAD_TURN_THRESHOLD = 0.25; // Nose offset ratio must exceed this for a valid turn
