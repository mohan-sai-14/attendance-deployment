// Get the current hostname and port from the browser
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  const { hostname, protocol } = window.location;
  
  // If running on localhost, use localhost:3000
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }
  
  // For network access, use the current hostname with port 3000
  return `${protocol}//${hostname}:3000/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  try {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || `${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Auth endpoints
export const login = async (credentials: { userId: string; password: string }) => {
  return fetchWithAuth('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const logout = async () => {
  return fetchWithAuth('/logout', {
    method: 'POST',
  });
};

export const getCurrentUser = async () => {
  return fetchWithAuth('/me');
};

// Session endpoints
export const getActiveSession = async () => {
  return fetchWithAuth('/sessions/active');
};

export const getAllSessions = async () => {
  return fetchWithAuth('/sessions');
};

export const createSession = async (sessionData: any) => {
  return fetchWithAuth('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
};

// Attendance endpoints
export async function getUserAttendance(userId?: string, limit: number = 10) {
  const url = `/attendance${userId ? `?userId=${userId}&limit=${limit}` : `?limit=${limit}`}`;
  return fetchWithAuth(url);
};

export const recordAttendance = async (sessionId: string) => {
  return fetchWithAuth('/attendance', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}; 