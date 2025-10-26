import axios from 'axios';
import { getApiUrl } from '../lib/config';

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    role: 'admin' | 'student';
  };
  message?: string;
}

export const login = async (userId: string, password: string): Promise<LoginResponse> => {
  try {
    console.log('Attempting login with:', { userId, password });
    const response = await axios.post(getApiUrl('/api/login'), 
      { userId, password },
      { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Login response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Login error:', error);
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      return {
        success: false,
        message: error.response.data.message || 'Login failed'
      };
    }
    return {
      success: false,
      message: 'Network error. Please try again.'
    };
  }
}; 
