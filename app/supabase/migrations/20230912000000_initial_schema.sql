-- Enable Row Level Security
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- Users table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'student',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batches/Classes
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  academic_year TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subjects
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teacher Assignments
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, batch_id, subject_id)
);

-- Student Enrollments
CREATE TABLE public.student_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, batch_id, academic_year)
);

-- Face Embeddings
CREATE TABLE public.face_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  embedding vector(512) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Sessions
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  qr_code TEXT NOT NULL,
  qr_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  session_date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attendance Records
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  face_verified BOOLEAN DEFAULT false,
  verification_confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- Holidays
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add more triggers for other tables as needed...

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin'
));

-- Add more RLS policies for other tables...

-- Create indexes for better performance
CREATE INDEX idx_attendance_records_session_id ON public.attendance_records(session_id);
CREATE INDEX idx_attendance_records_student_id ON public.attendance_records(student_id);
CREATE INDEX idx_face_embeddings_student_id ON public.face_embeddings(student_id);

-- Create a function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
