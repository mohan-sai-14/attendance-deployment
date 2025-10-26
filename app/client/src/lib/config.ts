/**
 * Configuration utilities for the application
 */

/**
 * Returns the base API URL for the current environment
 */
export function getApiUrl(path: string): string {
  // In development, use the computer's IP address when accessed from mobile
  if (import.meta.env.DEV) {
    // Get the current hostname
    const { hostname } = window.location;
    
    // If not localhost (i.e., accessed via IP), use the current hostname with port 3000
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:3000${path}`;
    }
    
    // Default to localhost for local development
    return `http://localhost:3000${path}`;
  }
  
  // For production, check if we have a configured API URL
  const apiBase = import.meta.env.VITE_API_URL || '';
  return `${apiBase}${path}`;
}

/**
 * Determines if the app is offline by checking network status
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Configuration for attendance
 */
export const attendanceConfig = {
  // How often to check for active sessions (ms)
  sessionRefreshInterval: 10000,
  
  // Time to keep local data valid in offline mode (ms)
  offlineCacheValidity: 24 * 60 * 60 * 1000, // 24 hours
  
  // Default QR code scan settings
  qrCode: {
    fps: 10,
    qrbox: 250,
  }
};

export const config = {
  // API endpoint configuration
  api: {
    baseUrl: import.meta.env.VITE_API_URL || '',
    timeout: 10000,
  },

  // Authentication configuration
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token',
  },

  // Session configuration
  session: {
    expirationTime: 20 * 60 * 1000, // 20 minutes in milliseconds
    checkInterval: 60 * 1000, // Check every minute
  },

  // QR code scan settings
  qrCode: {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0,
  },

  // Attendance settings
  attendance: {
    codeLength: 6,
    codeExpiry: 20 * 60, // 20 minutes
  },
}; 