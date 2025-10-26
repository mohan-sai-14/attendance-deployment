-- Enable Row Level Security on all tables
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.holidays ENABLE ROW LEVEL SECURITY;

-- Students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  roll_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  semester INTEGER NOT NULL,
  section TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty table
CREATE TABLE IF NOT EXISTS public.faculty (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  designation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  semester INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  qr_code TEXT,
  qr_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false,
  room_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'od', 'ml')),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  marked_by UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
  device_info JSONB,
  location POINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('od', 'ml')), -- On Duty / Medical Leave
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.faculty(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Holidays
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course_id ON public.sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student_id ON public.leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);

-- Update triggers for all tables with updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
CREATE OR REPLACE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_faculty_updated_at
BEFORE UPDATE ON public.faculty
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for Students
CREATE POLICY "Students can view their own profile"
  ON public.students FOR SELECT
  USING (auth.uid() = id);

-- RLS Policies for Faculty
CREATE POLICY "Faculty can view their own profile"
  ON public.faculty FOR SELECT
  USING (auth.uid() = id);

-- RLS Policies for Sessions
CREATE POLICY "Faculty can manage their sessions"
  ON public.sessions
  FOR ALL
  USING (faculty_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for Attendance
CREATE POLICY "Faculty can manage attendance for their sessions"
  ON public.attendance
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sessions s 
    WHERE s.id = session_id 
    AND (s.faculty_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin')
  ));

-- Students can view their own attendance
CREATE POLICY "Students can view their own attendance"
  ON public.attendance
  FOR SELECT
  USING (student_id = auth.uid());

-- RLS for Leave Requests
CREATE POLICY "Students can manage their own leave requests"
  ON public.leave_requests
  FOR ALL
  USING (student_id = auth.uid() OR auth.jwt() ->> 'role' IN ('faculty', 'admin'));

-- Enable RLS on all tables
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;
ALTER TABLE public.faculty FORCE ROW LEVEL SECURITY;
ALTER TABLE public.courses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.holidays FORCE ROW LEVEL SECURITY;
