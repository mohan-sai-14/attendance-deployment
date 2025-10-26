/**
 * Location utilities for geofencing and distance calculations
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Get current position using browser Geolocation API
 * @returns Promise with coordinates
 */
export const getCurrentPosition = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in meters
 */
export const calculateDistance = (
  coord1: Coordinates,
  coord2: Coordinates
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters

  return Math.round(distance);
};

/**
 * Check if student is within allowed radius
 * @param studentCoords Student coordinates
 * @param teacherCoords Teacher coordinates
 * @param allowedRadius Allowed radius in meters (default 150)
 * @returns Object with verification result
 */
export const verifyLocation = (
  studentCoords: Coordinates,
  teacherCoords: Coordinates,
  allowedRadius: number = 150
): { isWithinRange: boolean; distance: number } => {
  const distance = calculateDistance(studentCoords, teacherCoords);
  
  return {
    isWithinRange: distance <= allowedRadius,
    distance,
  };
};

/**
 * Format distance for display
 * @param meters Distance in meters
 * @returns Formatted string
 */
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
};

/**
 * Request location permission and get coordinates
 * @returns Promise with coordinates or error
 */
export const requestLocationPermission = async (): Promise<Coordinates> => {
  try {
    const coords = await getCurrentPosition();
    return coords;
  } catch (error) {
    throw error;
  }
};
