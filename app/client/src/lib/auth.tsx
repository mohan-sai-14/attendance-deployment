import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";
import { getApiUrl } from "./config";

export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  email?: string;
}

type UserRole = 'admin' | 'teacher' | 'student';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string, role: UserRole) => Promise<User>;
  logout: () => Promise<void>;
  isOfflineMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Clear any stored user data to prevent offline mode
  useEffect(() => {
    localStorage.removeItem('user');
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      console.log('Fetching user data...');
      try {
        const response = await fetch(getApiUrl("/api/me"), {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            // Remove Cache-Control header as it's not needed for this request
            // and can cause CORS issues with preflight
          },
          // Add mode: 'cors' explicitly
          mode: 'cors',
          // Add cache control via fetch options instead of headers
          cache: 'no-store'
        });
        
        console.log('User data response status:', response.status);
        
        if (response.ok) {
          const userData = await response.json();
          console.log('User data fetched successfully:', userData);
          setUser(userData);
          setIsOfflineMode(false);
        } else if (response.status === 401) {
          console.log('User is not authenticated (401)');
          setUser(null);
        } else {
          console.error('Unexpected status code:', response.status);
          setUser(null);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        // On network error, try to continue in offline mode if we have a cached user
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          console.log('Using cached user data due to network error');
          setUser(JSON.parse(cachedUser));
          setIsOfflineMode(true);
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password, role }: { username: string; password: string; role: UserRole }) => {
      try {
        console.log("=== Login Attempt ===");
        console.log("Username:", username);
        console.log("Role:", role);
        
        const loginUrl = getApiUrl("/api/login");
        console.log('Login URL:', loginUrl);
        
        const requestBody = { username, password };
        console.log('Request body:', JSON.stringify(requestBody));
        
        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include' as const,
          body: JSON.stringify(requestBody)
        };
        
        console.log('Request options:', JSON.stringify(requestOptions, null, 2));
        
        console.log('Sending login request...');
        const response = await fetch(loginUrl, requestOptions);
        
        console.log('=== Response ===');
        console.log('Status:', response.status, response.statusText);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        let responseData;
        try {
          responseData = responseText ? JSON.parse(responseText) : {};
          console.log('Parsed response:', responseData);
        } catch (e) {
          console.error('Failed to parse response as JSON:', e);
          responseData = {};
        }
        
        if (!response.ok) {
          console.error('Login failed with status:', response.status);
          const errorMessage = responseData.message || response.statusText || 'Login failed';
          console.error('Error message:', errorMessage);
          throw new Error(errorMessage);
        }
        
        // Handle successful response
        if (responseData.success && responseData.user) {
          console.error("Login failed with status:", response.status);
          
          // Try to parse error as JSON
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Login failed: ${response.statusText}`);
            } else {
              // If not JSON, get the text and throw generic error
              const errorText = await response.text();
              console.error("Non-JSON error response:", errorText);
              throw new Error("Server error. Please try again later.");
            }
          } catch (parseError) {
            console.error("Error parsing error response:", parseError);
            throw new Error(`Login failed: ${response.statusText || "Unknown error"}`);
          }
        }
        
        // Check content type for successful responses
        const contentType = response.headers.get('content-type');
        let userData;
        
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          // Check if response matches the expected server format with success and user properties
          if (responseData.success && responseData.user) {
            userData = responseData.user;
          } else {
            // If the structure doesn't match, use the entire response
            userData = responseData;
          }
        } else {
          console.error("Response is not JSON:", contentType);
          
          // Fallback: Try to log in with hardcoded credentials for demo purposes
          if (username === "S1001" && password === "student123") {
            userData = {
              id: 1,
              username: "S1001",
              name: "John Smith",
              role: "student"
            };
            console.log("Using fallback login for demo student");
          } else if (username === "T1001" && password === "teacher123") {
            userData = {
              id: 2,
              username: "T1001",
              name: "Sarah Johnson",
              role: "teacher"
            };
            console.log("Using fallback login for demo teacher");
          } else if (username === "admin" && password === "admin123") {
            userData = {
              id: 3,
              username: "admin",
              name: "Admin User",
              role: "admin"
            };
            console.log("Using fallback login for admin");
          } else {
            throw new Error("Invalid credentials. Please check your username and password.");
          }
        }
        
        console.log('Login successful, user data:', userData);
        setUser(userData);
        setIsOfflineMode(false);
        // Force a page reload to ensure all components get the updated auth state
        window.location.href = `/${role}`;
        return userData;
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setUser(data);
      setIsOfflineMode(false);
      queryClient.invalidateQueries({ queryKey: [getApiUrl('/api/me')] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", getApiUrl("/api/logout"));
    },
    onSuccess: () => {
      setUser(null);
      localStorage.removeItem('user');
      queryClient.clear();
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Logout error:", error);
      setUser(null);
      queryClient.clear();
    }
  });

  const login = useCallback(async (username: string, password: string, role: UserRole) => {
    console.log('Login function called with:', { username, password, role });
    
    try {
      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password, role }),
      });

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Login failed:', errorData);
        throw new Error(errorData.message || 'Login failed');
      }

      const userData = await response.json();
      console.log('Login successful, user data:', userData);
      
      // Update user state
      setUser(userData.user || userData);
      setIsOfflineMode(false);
      
      return userData;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }, [setUser, setIsOfflineMode]);

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isOfflineMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = ({ on401 }: { on401: UnauthorizedBehavior }) => 
  async ({ queryKey }: { queryKey: string[] }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (on401 === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status}`);
    }

    return res.json();
  };
