export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface Session {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  date?: string;
  time?: string;
  duration?: number;
  qr_code?: string;
}

export interface SessionInfo {
  id: string;
  name: string;
  date: string;
  time: string;
  description?: string;
}

export interface Attendance {
  id: string;
  username: string;
  session_id: string;
  check_in_time: string | null;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  session_name: string;
  session: SessionInfo;
  created_at?: string;
  updated_at?: string;
}