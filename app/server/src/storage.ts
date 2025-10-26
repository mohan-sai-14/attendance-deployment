import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { User, Session, Attendance } from './types';
import fetch from 'node-fetch';
import path from 'path';

// Fix for fetch not being available in some Node environments
// @ts-ignore
if (!globalThis.fetch) {
  // @ts-ignore
  globalThis.fetch = fetch;
}

// Load environment variables using absolute path
const envPath = path.resolve(__dirname, '../../../.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class SupabaseStorage {
  public supabase: SupabaseClient | null;
  private useSupabase: boolean;

  constructor() {
    this.useSupabase = !!(supabaseUrl && supabaseKey);
    
    console.log('Initializing Supabase storage:');
    console.log('- URL available:', !!supabaseUrl);
    console.log('- API key available:', !!supabaseKey);
    console.log('- URL:', supabaseUrl);
    // Only log the first few characters of the key for security
    console.log('- Key begins with:', supabaseKey?.substring(0, 10) + '...');
    
    if (this.useSupabase) {
      try {
        this.supabase = createClient(supabaseUrl!, supabaseKey!, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        console.log('Supabase client initialized successfully');
      } catch (error) {
        console.error('Error initializing Supabase client:', error);
        this.supabase = null;
        this.useSupabase = false;
      }
    } else {
      this.supabase = null;
      console.log('Using mock storage - Supabase credentials not found');
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        // Mock user for development
        if (userId === 'S1001') {
          return {
            id: 1,
            username: 'S1001',
            password: 'student123',
            name: 'Student One',
            email: 'mohansaireddy54@gmail.com',
            role: 'student',
            status: 'active'
          };
        } else if (userId === 'admin') {
          return {
            id: 2,
            username: 'admin',
            password: 'admin123',
            name: 'mohan',
            email: 'mohansaireddy22@gmail.com',
            role: 'admin',
            status: 'active'
          };
        }
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', userId)
        .single();

      if (error) {
        console.error('Error getting user:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error in getUser:', error);
      return null;
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        // Mock user for development
        if (username === 'S1001') {
          return {
            id: 1,
            username: 'S1001',
            password: 'student123',
            name: 'Student One',
            email: 'mohansaireddy54@gmail.com',
            role: 'student',
            status: 'active'
          };
        } else if (username === 'admin') {
          return {
            id: 2,
            username: 'admin',
            password: 'admin123',
            name: 'mohan',
            email: 'mohansaireddy22@gmail.com',
            role: 'admin',
            status: 'active'
          };
        }
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('Error getting user by username:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      return null;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('username');

      if (error) {
        console.error('Error getting all users:', error);
        return [];
      }

      return data as User[];
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      return [];
    }
  }

  async getUsersByRole(role: string): Promise<User[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', role)
        .order('username');

      if (error) {
        console.error('Error getting users by role:', error);
        return [];
      }

      return data as User[];
    } catch (error) {
      console.error('Error in getUsersByRole:', error);
      return [];
    }
  }

  async createUser(userData: any): Promise<User | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error in createUser:', error);
      return null;
    }
  }

  async updateUser(userId: number, userData: any): Promise<User | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error in updateUser:', error);
      return null;
    }
  }

  async deleteUser(userId: number): Promise<boolean> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return true;
      }

      const supabase = this.supabase;
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteUser:', error);
      return false;
    }
  }

  async validateUser(userId: string, password: string): Promise<boolean> {
    try {
      console.log('Validating user:', userId);
      
      if (!this.useSupabase || !this.supabase) {
        console.log('Using mock validation for user:', userId);
        const mockValid = (userId === 'S1001' && password === 'student123') || 
                         (userId === 'admin' && password === 'admin123');
        console.log('Mock validation result:', mockValid);
        return mockValid;
      }

      console.log('Querying Supabase for user:', userId);
      console.log('Query details:');
      console.log('- Table: users');
      console.log('- Condition: username =', userId);
      
      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', userId)
        .single();

      if (error) {
        console.error('Supabase error validating user:', error);
        console.log('Error details:', JSON.stringify(error));
        return false;
      }

      if (!data) {
        console.log('No user found with username:', userId);
        return false;
      }

      // For debugging
      console.log('Found user in database:', {
        username: data.username,
        hasPassword: !!data.password,
        passwordLength: data.password ? data.password.length : 0,
        providedPassword: password,
        providedPasswordLength: password.length,
        passwordsMatch: data.password === password
      });

      return data.password === password;
    } catch (error) {
      console.error('Error in validateUser:', error);
      return false;
    }
  }

  async getActiveSession(userId?: string): Promise<Session | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      let query = supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (userId) {
        query = query.eq('created_by', userId);
      }

      // Use .maybeSingle() instead of .single() to prevent errors when multiple rows exist
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error getting active session:', error);
        return null;
      }

      return data as Session;
    } catch (error) {
      console.error('Error in getActiveSession:', error);
      return null;
    }
  }

  async getAllSessions(): Promise<Session[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting all sessions:', error);
        return [];
      }

      return data as Session[];
    } catch (error) {
      console.error('Error in getAllSessions:', error);
      return [];
    }
  }

  async createSession(sessionData: Partial<Session>): Promise<Session | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      // First, deactivate any existing active sessions for this user
      if (sessionData.created_by) {
        await supabase
          .from('sessions')
          .update({ is_active: false })
          .eq('created_by', sessionData.created_by)
          .eq('is_active', true);
      }

      // Parse the expiry time if provided, otherwise default to 24 hours
      let expiresAt: Date;
      
      if (sessionData.expires_at) {
        // If expires_at is provided, use it directly (should be in ISO format)
        expiresAt = new Date(sessionData.expires_at);
        console.log(`Using provided expiry time: ${expiresAt.toISOString()}`);
      } else if (sessionData.date) {
        // If only date is provided, set expiry to end of that day in local time
        const [year, month, day] = sessionData.date.split('-').map(Number);
        expiresAt = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
        console.log(`Using end of day expiry: ${expiresAt.toISOString()}`);
      } else {
        // Default to 24 hours from now in local time
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        console.log(`Using default 24h expiry: ${expiresAt.toISOString()}`);
      }
      
      // Ensure the time is stored in UTC
      const utcExpiresAt = new Date(expiresAt.getTime() - (expiresAt.getTimezoneOffset() * 60000));
      console.log(`Storing expiry time in UTC: ${utcExpiresAt.toISOString()}`);

      // Create new session
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          ...sessionData,
          created_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      console.log('Session created successfully:', data);
      console.log('Expires at (local):', new Date(data.expires_at).toString());
      return data as Session;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  }

  async expireSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return true;
      }

      const supabase = this.supabase;
      const { error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) {
        console.error('Error expiring session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in expireSession:', error);
      return false;
    }
  }

  async getAllAttendance(): Promise<Attendance[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      
      // First, get all users who are not admins or teachers
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('username, name, role')
        .neq('role', 'admin')
        .neq('role', 'teacher')
        .eq('status', 'active');

      if (usersError) {
        console.error('Error fetching user details:', usersError);
        return [];
      }

      if (!users || users.length === 0) {
        return [];
      }

      // Get usernames of non-admin, non-teacher users
      const eligibleUsernames = users.map(user => user.username);
      
      // Get attendance records only for eligible users
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .in('username', eligibleUsernames)
        .order('check_in_time', { ascending: false });

      if (attendanceError) {
        console.error('Error getting attendance records:', attendanceError);
        return [];
      }

      if (!attendanceData || attendanceData.length === 0) {
        return [];
      }

      // Create a map of username to user details
      const userMap = new Map(users.map(user => [user.username, user]));

      // Combine attendance data with user names
      const attendanceWithNames = attendanceData.map(record => ({
        ...record,
        name: userMap.get(record.username)?.name || 'Unknown'
      }));

      return attendanceWithNames as unknown as Attendance[];
    } catch (error) {
      console.error('Error in getAllAttendance:', error);
      return [];
    }
  }

  async getUserAttendance(username: string): Promise<Attendance[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        console.log('Using mock storage - returning empty attendance array');
        return [];
      }

      const supabase = this.supabase;
      console.log(`Fetching attendance for user: ${username}`);
      
      // First, get all sessions to ensure we show all sessions, even without attendance
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false });

      if (sessionsError) {
        console.error('Error getting sessions:', sessionsError);
        return [];
      }
      console.log(`Found ${sessions.length} sessions in the database`);

      // Get the user's attendance records with session details
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select(`
          id,
          username,
          session_id,
          check_in_time,
          status,
          name,
          session_name,
          session:session_id (
            id,
            name,
            date,
            time,
            description
          )
        `)
        .eq('username', username);

      if (error) {
        console.error('Error getting user attendance:', error);
        return [];
      }
      console.log(`Found ${attendanceData?.length || 0} attendance records for user ${username}`);

      // Create a map of session_id to attendance record
      const attendanceMap = new Map();
      
      if (attendanceData) {
        attendanceData.forEach(record => {
          // Safely access session data with proper null checks
          const session = Array.isArray(record.session) ? record.session[0] : record.session;
          if (session) {
            attendanceMap.set(record.session_id, {
              id: record.id,
              username: record.username,
              session_id: record.session_id,
              check_in_time: record.check_in_time,
              status: record.status || 'present',
              name: record.name || 'Student',
              session_name: record.session_name || session.name || 'Session',
              date: session.date || new Date().toISOString().split('T')[0],
              time: session.time || '00:00',
              session: {
                id: session.id,
                name: session.name || 'Session',
                date: session.date || new Date().toISOString().split('T')[0],
                time: session.time || '00:00',
                description: session.description || ''
              }
            });
          }
        });
      }

      // For sessions without attendance, create absent records
      const allSessionsWithAttendance = sessions.map(session => {
        const attendance = attendanceMap.get(session.id);
        if (attendance) {
          return attendance;
        }
        
        // If no attendance record exists, create an absent record
        return {
          id: `session-${session.id}`,
          username: username,
          session_id: session.id,
          check_in_time: null,
          date: session.date || new Date().toISOString().split('T')[0],
          status: 'absent',
          name: 'Student',
          session_name: session.name || 'Session',
          session: {
            id: session.id,
            name: session.name || 'Session',
            date: session.date || new Date().toISOString().split('T')[0],
            time: session.time || '00:00',
            description: session.description || ''
          }
        };
      });

      console.log(`Returning ${allSessionsWithAttendance.length} attendance records (including absent sessions)`);
      return allSessionsWithAttendance as unknown as Attendance[];
    } catch (error) {
      console.error('Error in getUserAttendance:', error);
      return [];
    }
  }

  async recordAttendance(username: string, session_id: string): Promise<Attendance | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      
      // First, get the user to check their role, status, and get their name
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role, name, status')
        .eq('username', username)
        .single();

      if (userError) {
        console.error('Error fetching user:', userError);
        return null;
      }

      // Skip attendance recording for admin and teacher roles
      if (user.role === 'admin' || user.role === 'teacher') {
        console.log(`❌ Skipping attendance recording for ${user.role} user: ${username} (${user.name || 'no name'})`);
        return null;
      }
      
      // Check if user is active
      if (user.status !== 'active') {
        console.log(`❌ Skipping attendance recording for inactive user: ${username} (status: ${user.status})`);
        return null;
      }
      // Check if attendance already exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', username)
        .eq('session_id', session_id)
        .single();

      if (existing) {
        console.log('Attendance already recorded');
        return existing as Attendance;
      }

      // Record new attendance with role
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          username: username,
          role: user.role || 'student',
          session_id,
          check_in_time: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0], // Add date in YYYY-MM-DD format
          status: 'present',
          name: user.name || username // Add user's name if available
        }])
        .select()
        .single();

      if (error) {
        console.error('Error recording attendance:', error);
        return null;
      }

      return data as Attendance;
    } catch (error) {
      console.error('Error in recordAttendance:', error);
      return null;
    }
  }

  async markAttendance(attendanceData: {
    username: string;
    session_id: string;
    check_in_time: string;
    status: string;
  }): Promise<Attendance | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      
      // Check if attendance already exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', attendanceData.username)
        .eq('session_id', attendanceData.session_id)
        .single();

      if (existing) {
        console.log('Attendance already recorded');
        return existing as Attendance;
      }

      // Record new attendance with date
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          ...attendanceData,
          date: new Date().toISOString().split('T')[0], // Add date in YYYY-MM-DD format
        }])
        .select()
        .single();

      if (error) {
        console.error('Error marking attendance:', error);
        return null;
      }

      return data as Attendance;
    } catch (error) {
      console.error('Error in markAttendance:', error);
      return null;
    }
  }

  async getAttendanceBySession(sessionId: string): Promise<Attendance[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      
      // First, get all non-admin, non-teacher, active users
      const { data: eligibleUsers, error: usersError } = await supabase
        .from('users')
        .select('username, name')
        .neq('role', 'admin')
        .neq('role', 'teacher')
        .eq('status', 'active');

      if (usersError) {
        console.error('Error fetching eligible users:', usersError);
        return [];
      }

      if (!eligibleUsers || eligibleUsers.length === 0) {
        return [];
      }

      const eligibleUsernames = eligibleUsers.map(user => user.username);
      
      // Get attendance records only for eligible users
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          user:username (name)
        `)
        .eq('session_id', sessionId)
        .in('username', eligibleUsernames)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error getting attendance by session:', error);
        return [];
      }

      // Transform the data to include the user's name directly in the attendance record
      const userMap = new Map(eligibleUsers.map(user => [user.username, user]));
      const attendanceWithNames = data
        .filter(record => userMap.has(record.username)) // Double-check eligibility
        .map(record => ({
          ...record,
          name: userMap.get(record.username)?.name || 'Unknown'
        }));

      return attendanceWithNames as unknown as Attendance[];
    } catch (error) {
      console.error('Error in getAttendanceBySession:', error);
      return [];
    }
  }

  async getAttendanceBySessionAndUser(sessionId: string, userId: string): Promise<Attendance | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      
      // First, check if the user is an admin, teacher, or inactive
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role, status')
        .eq('username', userId)
        .single();

      if (userError) {
        console.error('Error fetching user details:', userError);
        return null;
      }

      // Skip if user is admin, teacher, or inactive
      if (user.role === 'admin' || user.role === 'teacher' || user.status !== 'active') {
        console.log(`Skipping attendance for user ${userId} (role: ${user.role}, status: ${user.status})`);
        return null;
      }

      // Get attendance record for the user and session
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', sessionId)
        .eq('username', userId)
        .single();

      if (error) {
        console.error('Error getting attendance by session and user:', error);
        return null;
      }

      return data as Attendance;
    } catch (error) {
      console.error('Error in getAttendanceBySessionAndUser:', error);
      return null;
    }
  }

  async getAttendanceByUser(userId: string): Promise<Attendance[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      
      // First, get the user to check their role and status
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role, status')
        .eq('username', userId)
        .single();

      if (userError) {
        console.error('Error fetching user details:', userError);
        return [];
      }

      // Skip if user is admin, teacher, or inactive
      if (user.role === 'admin' || user.role === 'teacher' || user.status !== 'active') {
        console.log(`Skipping attendance for user ${userId} (role: ${user.role}, status: ${user.status})`);
        return [];
      }

      // Get attendance records for the user
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          user:username (name)
        `)
        .eq('username', userId)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error getting attendance by user:', error);
        return [];
      }

      // Transform the data to include the user's name directly in the attendance record
      const attendanceWithNames = data.map(record => ({
        ...record,
        name: record.user?.name || 'Unknown'
      }));

      return attendanceWithNames as unknown as Attendance[];
    } catch (error) {
      console.error('Error in getAttendanceByUser:', error);
      return [];
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.useSupabase || !this.supabase) {
        console.log('Cannot test connection - Supabase not initialized');
        return false;
      }
      
      console.log('Testing Supabase connection...');
      const supabase = this.supabase;
      
      // Try to query the users table
      const { data, error } = await supabase
        .from('users')
        .select('count(*)')
        .limit(1);
        
      if (error) {
        console.error('Connection test failed:', error);
        return false;
      }
      
      console.log('Connection test successful. Data:', data);
      return true;
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  }

  async getTableInfo(tableName: string): Promise<any> {
    try {
      if (!this.useSupabase || !this.supabase) {
        console.log(`Cannot get table info for ${tableName} - Supabase not initialized`);
        return null;
      }
      
      console.log(`Getting table info for ${tableName}...`);
      const supabase = this.supabase;
      
      // Try to get a single row to inspect columns
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        console.error(`Error getting ${tableName} info:`, error);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log(`No data found in ${tableName}`);
        return { columns: [] };
      }
      
      // Extract column names from the first row
      const columns = Object.keys(data[0]).map(column => ({
        name: column,
        type: typeof data[0][column]
      }));
      
      console.log(`Table ${tableName} columns:`, columns);
      return { columns };
    } catch (error) {
      console.error(`Error getting ${tableName} info:`, error);
      return null;
    }
  }

  private async markUsersAbsent(sessionId: string, users: any[], sessionName: string): Promise<void> {
    if (!this.useSupabase || !this.supabase) {
      console.log('Supabase not configured, skipping markUsersAbsent');
      return;
    }

    try {
      console.log(`\n=== Starting markUsersAbsent for session ${sessionId} (${sessionName}) ===`);
      console.log(`Total users to process: ${users.length}`);
      
      const now = new Date();
      
      console.log('\n=== Verifying user roles and statuses before marking absent ===');
      
      // First, get all users with their roles and status to ensure we don't mark admins/teachers/inactive users
      const usernames = users.map(u => u.username).filter(Boolean);
      console.log(`Fetching roles and status for ${usernames.length} users:`, usernames);
      
      // Use the same query approach as the client-side code that works
      const { data: userRoles, error: rolesError } = await this.supabase
        .from('users')
        .select(`
          username,
          name,
          role,
          status,
          enroll_no,
          registered_no,
          department,
          section,
          program,
          year
        `)
        .in('username', usernames);
        
      if (rolesError) {
        console.error('❌ Error fetching user roles:', rolesError);
        console.error('Error details:', JSON.stringify(rolesError, null, 2));
        return;
      }
      
      console.log(`Retrieved ${userRoles?.length || 0} user records from database`);
      if (userRoles && userRoles.length > 0) {
        console.log('Sample user data:', JSON.stringify(userRoles[0], null, 2));
        console.log('All user data:');
        userRoles.forEach(user => {
          console.log(`- ${user.username}:`, JSON.stringify(user, null, 2));
        });
      } else {
        console.log('❌ No user data retrieved from database');
        console.log('Available usernames:', usernames);
        return;
      }

      const userDataMap = new Map(userRoles.map(user => [user.username, user]));
      
      console.log('\n=== Filtering eligible users for absent marking ===');
      
      // Prepare attendance records for absent users, excluding admins, teachers, and inactive users
      const attendanceRecords = users
        .filter(user => {
          if (!user.username || typeof user.username !== 'string') {
            console.log(`❌ Invalid username:`, user.username);
            return false;
          }
          
          const username = user.username.trim();
          const userData = userDataMap.get(username);
          
          // If we couldn't find the user in the database, skip them
          if (!userData) {
            console.log(`❌ User not found in database: ${username} - skipping`);
            return false;
          }
          
          console.log(`🔍 User data for ${username}:`, JSON.stringify(userData, null, 2));
          
          const role = userData.role || user.role;
          const status = userData.status || user.status;
          
          // Check if the user is an admin or teacher
          if (role === 'admin' || role === 'teacher') {
            console.log(`⏩ SKIPPING - ${role} user: ${username} (${userData.name || 'no name'})`);
            return false;
          }
          
          // Check if the user is inactive
          if (status !== 'active') {
            console.log(`⏩ SKIPPING - Inactive user (${status}): ${username} (${userData.name || 'no name'})`);
            return false;
          }
          
          // If we get here, the user is eligible for absent marking
          console.log(`✅ INCLUDING - ${role || 'student'} user: ${username} (${userData.name || 'no name'})`);
          return true;
        })
        .map(user => {
          const username = user.username.trim();
          const userData = userRoles.find(u => u.username === username);
          
          // Create the attendance record with all required fields
          const record = {
            session_id: sessionId,
            username: username,
            role: userData?.role || 'student',
            status: 'absent',
            check_in_time: now.toISOString(),
            name: (userData?.name || user.name || username || 'Unknown').toString().trim(),
            date: now.toISOString().split('T')[0],
            session_name: sessionName.toString(),
            enroll_no: userData?.enroll_no ?? '',
            registered_no: userData?.registered_no ?? '',
            department: userData?.department ?? '',
            program: userData?.program ?? '',
            section: userData?.section ?? '',
            year: userData?.year ?? ''
          };
          
          console.log(`📝 Creating absent record for ${username}:`, JSON.stringify(record, null, 2));
          
          return record;
        });
        
      console.log(`\n=== Attendance Records to Create ===`);
      console.log(`Total eligible users for absent marking: ${attendanceRecords.length}`);
      attendanceRecords.forEach((record, index) => {
        console.log(`${index + 1}. ${record.username} (${record.name}) - Role: ${record.role}`);
      });
        
      if (attendanceRecords.length === 0) {
        console.log('No valid attendance records to process');
        return;
      }

      // Insert attendance records in batches to avoid hitting limits
      const batchSize = 50; // Smaller batch size for safety
      let successCount = 0;
      
      for (let i = 0; i < attendanceRecords.length; i += batchSize) {
        const batch = attendanceRecords.slice(i, i + batchSize);
        const batchNumber = Math.floor(i/batchSize) + 1;
        
        console.log(`Processing batch ${batchNumber} (${i+1}-${Math.min(i+batchSize, attendanceRecords.length)} of ${attendanceRecords.length})`);
        
        const { error: insertError } = await this.supabase
          .from('attendance')
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting batch ${batchNumber}:`, insertError);
          // Try inserting one by one to identify problematic records
          for (const record of batch) {
            const { error } = await this.supabase
              .from('attendance')
              .insert(record);
              
            if (error) {
              console.error(`  - Failed to mark user ${record.username}:`, error);
            } else {
              successCount++;
            }
          }
        } else {
          successCount += batch.length;
          console.log(`  - Successfully marked ${batch.length} users as absent`);
        }
      }
      
      console.log(`\n✅ Successfully marked ${successCount} out of ${attendanceRecords.length} users as absent`);
      
      if (successCount < attendanceRecords.length) {
        console.warn(`⚠️ Failed to mark ${attendanceRecords.length - successCount} users as absent`);
      }
      
    } catch (error) {
      console.error('Error in markUsersAbsent:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  private async markStudentsAbsent(sessionId: string, students: any[]): Promise<void> {
    if (!this.useSupabase || !this.supabase) {
      console.log('Supabase not configured, skipping markStudentsAbsent');
      return;
    }

    try {
      console.log(`\nPreparing to mark ${students.length} students as absent...`);
      
      // Prepare attendance records for absent students
      const attendanceRecords = students.map((student) => ({
        session_id: sessionId,
        student_id: student.id,
        status: 'absent',
        marked_at: new Date().toISOString()
      }));

      // Insert attendance records in batches to avoid hitting limits
      const batchSize = 100;
      let successCount = 0;
      
      for (let i = 0; i < attendanceRecords.length; i += batchSize) {
        const batch = attendanceRecords.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1} (${i+1}-${Math.min(i+batchSize, attendanceRecords.length)} of ${attendanceRecords.length})`);
        
        const { error: insertError } = await this.supabase
          .from('attendance')
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        } else {
          successCount += batch.length;
          console.log(`Successfully marked ${batch.length} students as absent in this batch`);
        }
      }
      
      console.log(`\n✅ Successfully marked ${successCount} out of ${attendanceRecords.length} students as absent`);
      
      if (successCount < attendanceRecords.length) {
        console.warn(`⚠️ Failed to mark ${attendanceRecords.length - successCount} students as absent`);
      }
      
    } catch (error) {
      console.error('Error in markStudentsAbsent:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  private async markAbsentStudents(sessionId: string): Promise<void> {
    if (!this.useSupabase || !this.supabase) {
      console.log('Supabase not configured, skipping markAbsentStudents');
      return;
    }

    try {
      console.log(`\n=== Marking absent students for session ${sessionId} ===`);
      
      // First, get the session details to verify it exists and get the session name
      const { data: session, error: sessionError } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        console.error('Error fetching session:', sessionError || 'Session not found');
        return;
      }
      
      console.log(`Session found: ${session.name} (ID: ${session.id})`);
      
      // Get all users who have already marked attendance for this session
      const { data: presentUsers, error: attendanceError } = await this.supabase
        .from('attendance')
        .select('username')
        .eq('session_id', sessionId);
        
      if (attendanceError) {
        console.error('Error fetching attendance records:', attendanceError);
        return;
      }
      
      // Get all active users first to see what we're working with
      const { data: allActiveUsers, error: allUsersError } = await this.supabase
        .from('users')
        .select('id, name, username, email, role, status')
        .eq('status', 'active');
        
      if (allUsersError) {
        console.error('Error fetching all active users:', allUsersError);
        return;
      }
      
      if (!allActiveUsers || allActiveUsers.length === 0) {
        console.log('No active users found in the system');
        return;
      }
      
      // Log all active users and their roles for debugging
      console.log('\n=== Active Users and Roles ===');
      allActiveUsers.forEach(user => {
        console.log(`- ${user.username} (${user.name}): ${user.role || 'no role'}`);
      });
      
      // Filter out admin and teacher users and inactive users
      const allUsers = allActiveUsers.filter(user => {
        const isAdminOrTeacher = user.role === 'admin' || user.role === 'teacher';
        const isInactive = user.status !== 'active';
        const shouldInclude = !isAdminOrTeacher && !isInactive;
        
        if (isAdminOrTeacher) {
          console.log(`- ${user.username}: EXCLUDED (${user.role} role)`);
        } else if (isInactive) {
          console.log(`- ${user.username}: EXCLUDED (inactive status: ${user.status})`);
        } else {
          console.log(`- ${user.username}: INCLUDED (${user.role || 'student'} role, active)`);
        }
        
        return shouldInclude;
      });
      
      if (allUsers.length === 0) {
        console.log('\n⚠️ No eligible active users found (excluding admins, teachers, and inactive users)');
        return;
      }
      
      console.log(`\n✅ Proceeding with ${allUsers.length} eligible users for absent marking`);
      
      // Get usernames of users who have already marked attendance
      const presentUsernames = new Set(
        presentUsers
          ?.map(record => record.username?.toString())
          .filter(Boolean) || []
      );
      
      // Filter out users who have already marked attendance
      const absentUsers = allUsers.filter(user => 
        user.username && 
        !presentUsernames.has(user.username.toString())
      );
      
      // Double-check that we're not including any admin/teacher users
      const eligibleAbsentUsers = absentUsers.filter(user => {
        const isEligible = user.role !== 'admin' && 
                          user.role !== 'teacher' && 
                          user.status === 'active';
        
        if (!isEligible) {
          console.log(`⚠️ Filtering out ineligible user from absent list: ${user.username} (role: ${user.role}, status: ${user.status})`);
        }
        
        return isEligible;
      });
      
      console.log('Present usernames:', Array.from(presentUsernames));
      console.log('All eligible usernames:', allUsers.map(u => u.username));
      console.log('Eligible absent users:', eligibleAbsentUsers.map(u => u.username));
      console.log(`\nFound ${eligibleAbsentUsers.length} eligible users who haven't marked attendance out of ${allUsers.length} active users`);
      
      if (eligibleAbsentUsers.length > 0) {
        console.log(`\n=== Marking ${eligibleAbsentUsers.length} eligible users as absent ===`);
        eligibleAbsentUsers.forEach((user, index) => {
          console.log(`${index + 1}. ${user.username} (${user.name || 'No name'}) - ${user.role || 'student'}`);
        });
        
        await this.markUsersAbsent(sessionId, eligibleAbsentUsers, session.name);
      } else {
        console.log('No eligible absent users to mark for this session');
      }
    } catch (error) {
      console.error('Error in markAbsentStudents:', error);
    }
  }

  async updateExpiredSessions(): Promise<void> {
    try {
      if (!this.useSupabase || !this.supabase) {
        console.log('Skipping session expiration check - Supabase not configured');
        return;
      }

      // Get current time in UTC
      const now = new Date();
      const nowISOString = now.toISOString();
      
      console.log(`Checking for sessions that expired before ${nowISOString} (UTC)`);
      
      // First, log the sessions that should be expired
      const { data: sessionsToExpire, error: queryError } = await this.supabase
        .from('sessions')
        .select('*')
        .lt('expires_at', nowISOString)
        .eq('is_active', true);

      if (queryError) {
        console.error('Error querying sessions to expire:', queryError);
        return;
      }

      if (sessionsToExpire && sessionsToExpire.length > 0) {
        console.log(`Found ${sessionsToExpire.length} sessions to expire:`);
        
        // Process each expired session
        for (const session of sessionsToExpire) {
          console.log(`- Session ${session.id} expired at ${session.expires_at} (UTC)`);
          
          // Mark absent students before expiring the session
          await this.markAbsentStudents(session.id);
          
          // Mark the session as inactive
          const { error: updateError } = await this.supabase
            .from('sessions')
            .update({ is_active: false })
            .eq('id', session.id);

          if (updateError) {
            console.error(`Error expiring session ${session.id}:`, updateError);
          } else {
            console.log(`Successfully expired session ${session.id}`);
          }
        }
      } else {
        console.log('No sessions to expire');
      }
    } catch (error) {
      console.error('Error in updateExpiredSessions:', error);
    }
  }

  // Get the Supabase client (public method)
  getClient() {
    if (!this.useSupabase || !this.supabase) {
      throw new Error('Supabase client is not initialized');
    }
    return this.supabase;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Error getting session:', error);
        return null;
      }

      return data as Session;
    } catch (error) {
      console.error('Error in getSession:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, sessionData: any): Promise<Session | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('sessions')
        .update(sessionData)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating session:', error);
        return null;
      }

      return data as Session;
    } catch (error) {
      console.error('Error in updateSession:', error);
      return null;
    }
  }

  // Face enrollment and verification methods
  async enrollStudentFace(studentId: string, rollNumber: string, faceEmbedding: number[]): Promise<boolean> {
    if (!this.useSupabase || !this.supabase) {
      throw new Error('Supabase client is not initialized');
    }

    try {
      const { data, error } = await this.supabase.rpc('upsert_student_face', {
        p_student_id: studentId,
        p_roll_number: rollNumber,
        p_face_embedding: faceEmbedding
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error enrolling student face:', error);
      throw error;
    }
  }

  async getStudentFace(studentId: string): Promise<{ face_embedding: number[] } | null> {
    if (!this.useSupabase || !this.supabase) {
      throw new Error('Supabase client is not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('student_faces')
        .select('face_embedding')
        .eq('student_id', studentId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching student face:', error);
      return null;
    }
  }

  async verifyFace(studentId: string, inputEmbedding: number[], threshold = 0.65): Promise<{
    isMatch: boolean;
    similarity: number;
    threshold: number;
  }> {
    try {
      const storedFace = await this.getStudentFace(studentId);
      if (!storedFace) {
        return { isMatch: false, similarity: 0, threshold };
      }

      // Calculate cosine similarity
      const dotProduct = inputEmbedding.reduce((sum, val, i) => 
        sum + val * storedFace.face_embedding[i], 0);
      const magnitudeA = Math.sqrt(inputEmbedding.reduce((sum, val) => sum + val * val, 0));
      const magnitudeB = Math.sqrt(storedFace.face_embedding.reduce((sum, val) => sum + val * val, 0));
      
      const similarity = dotProduct / (magnitudeA * magnitudeB);
      
      return {
        isMatch: similarity >= threshold,
        similarity,
        threshold
      };
    } catch (error) {
      console.error('Error in face verification:', error);
      throw error;
    }
  }
}

export const storage = new SupabaseStorage(); 