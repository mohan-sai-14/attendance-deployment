import { createClient } from '@supabase/supabase-js';
import { Database } from '../../supabase-types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cbtlnniotuvdfwydrmzm.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NTkyODYsImV4cCI6MjA3MjAzNTI4Nn0.U5ipnkQr6aKHY4Oa6ct2ZaG5XtAv-XVV4W-ffUE2JJk';

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper function to handle errors
export const handleError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  throw new Error(error.message || `Error in ${context}`);
};

// Auth functions
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) handleError(error, 'signIn');
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) handleError(error, 'signOut');
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Profile functions
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) handleError(error, 'getProfile');
  return data;
};

// Session functions
export const createAttendanceSession = async (sessionData: {
  batch_id: string;
  subject_id: string;
  teacher_id: string;
  qr_code: string;
  qr_expires_at: string;
  session_date: string;
  start_time: string;
}) => {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert([sessionData])
    .select()
    .single();
    
  if (error) handleError(error, 'createAttendanceSession');
  return data;
};

// Attendance functions
export const markAttendance = async (attendanceData: {
  session_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  face_verified: boolean;
  verification_confidence?: number;
}) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert([attendanceData], { onConflict: 'session_id,student_id' })
    .select()
    .single();
    
  if (error) handleError(error, 'markAttendance');
  return data;
};

// Face embedding functions
export const storeFaceEmbedding = async (studentId: string, embedding: number[]) => {
  const { data, error } = await supabase
    .from('face_embeddings')
    .upsert(
      { student_id: studentId, embedding },
      { onConflict: 'student_id' }
    )
    .select()
    .single();
    
  if (error) handleError(error, 'storeFaceEmbedding');
  return data;
};

export const getFaceEmbedding = async (studentId: string) => {
  const { data, error } = await supabase
    .from('face_embeddings')
    .select('embedding')
    .eq('student_id', studentId)
    .single();
    
  if (error) handleError(error, 'getFaceEmbedding');
  return data?.embedding;
};

// Real-time subscriptions
export const subscribeToSessionUpdates = (sessionId: string, callback: (payload: any) => void) => {
  const subscription = supabase
    .channel(`attendance:session_id=eq.${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => callback(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};
