import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase/client';
import { getApiUrl } from '../lib/config';

type UserRole = 'admin' | 'teacher' | 'student';

interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  name?: string;
  status?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const normalizeUser = useMemo(
    () =>
      (rawUser: any): User => {
        const fullName = (rawUser.name ?? `${rawUser.first_name ?? ''} ${rawUser.last_name ?? ''}`).trim();
        const [firstName, ...rest] = fullName.split(' ').filter(Boolean);

        return {
          id: String(rawUser.id ?? rawUser.user_id ?? ''),
          email: rawUser.email ?? '',
          username: rawUser.username ?? '',
          role: (rawUser.role ?? 'student') as UserRole,
          first_name: rawUser.first_name ?? firstName ?? '',
          last_name: rawUser.last_name ?? rawUser.last_name ?? rest.join(' '),
          avatar_url: rawUser.avatar_url ?? undefined,
          name: fullName || undefined,
          status: rawUser.status,
        };
      },
    [],
  );

  const storeUser = useCallback((rawUser: any) => {
    const sanitizedUser = normalizeUser(rawUser);
    setUser(sanitizedUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(sanitizedUser));
    return sanitizedUser;
  }, [normalizeUser]);

  const clearStoredUser = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }, []);

  const fetchSessionUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/me'), {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredUser();
        }
        return;
      }

      const sessionUser = await response.json();
      storeUser(sessionUser);
    } catch (error) {
      console.error('Error fetching session user:', error);
    } finally {
      setLoading(false);
    }
  }, [clearStoredUser, storeUser]);

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    fetchSessionUser();
  }, [fetchSessionUser]);

  const isEmail = (identifier: string) => {
    // Simple email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(identifier);
  };

  const signIn = async (identifier: string, password: string) => {
    setLoading(true);
    console.log('Attempting to sign in with:', { identifier });
    
    try {
      let loginIdentifier = identifier.trim();

      if (loginIdentifier.length === 0) {
        throw new Error('Username or email is required');
      }

      console.log('Attempting login using identifier:', loginIdentifier);

      if (isEmail(loginIdentifier)) {
        const { data: emailUser, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', loginIdentifier)
          .maybeSingle();

        console.log('Email lookup result:', { emailUser, emailError });

        if (emailError || !emailUser?.username) {
          throw new Error('Invalid email or password');
        }

        loginIdentifier = emailUser.username;
      }

      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ userId: loginIdentifier, password }),
      });

      const result = await response.json().catch(() => ({}));
      console.log('Login response status:', response.status, 'body:', result);

      if (!response.ok || result?.success === false) {
        const message = result?.message || 'Invalid username/email or password';
        throw new Error(message);
      }

      const sessionUser = result?.user ?? result;

      if (!sessionUser) {
        throw new Error('Unable to retrieve user details from login response');
      }

      const sanitizedUser = storeUser(sessionUser);

      const role = sanitizedUser.role;
      console.log('Redirecting to dashboard for role:', role);

      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fetch(getApiUrl('/api/logout'), {
        method: 'POST',
        credentials: 'include',
      });
      clearStoredUser();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    await fetchSessionUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
