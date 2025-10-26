-- Database schema updates for face embedding system

-- Update users table to include face embedding fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_embeddings JSONB;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_enrollment_date TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_enrollment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_images_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_quality_score DECIMAL(3,2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS enroll_no TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS registered_no TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS program TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS year TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_face_enrollment_status ON public.users(face_enrollment_status);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department);
CREATE INDEX IF NOT EXISTS idx_users_program ON public.users(program);
CREATE INDEX IF NOT EXISTS idx_users_year ON public.users(year);
CREATE INDEX IF NOT EXISTS idx_users_section ON public.users(section);

-- Update the users table structure to match the attendance table
-- (assuming the attendance table structure you provided is correct)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
