-- Add location fields to attendance_sessions table for geofencing
ALTER TABLE public.attendance_sessions
ADD COLUMN teacher_lat DOUBLE PRECISION,
ADD COLUMN teacher_lng DOUBLE PRECISION,
ADD COLUMN location_name TEXT,
ADD COLUMN allowed_radius_meters INTEGER DEFAULT 150;

-- Add location fields to attendance_records for tracking where student marked attendance
ALTER TABLE public.attendance_records
ADD COLUMN student_lat DOUBLE PRECISION,
ADD COLUMN student_lng DOUBLE PRECISION,
ADD COLUMN distance_from_teacher_meters DOUBLE PRECISION,
ADD COLUMN location_verified BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.attendance_sessions.teacher_lat IS 'Teacher latitude when creating session';
COMMENT ON COLUMN public.attendance_sessions.teacher_lng IS 'Teacher longitude when creating session';
COMMENT ON COLUMN public.attendance_sessions.location_name IS 'Optional location name/description';
COMMENT ON COLUMN public.attendance_sessions.allowed_radius_meters IS 'Maximum distance in meters for student to mark attendance';

COMMENT ON COLUMN public.attendance_records.student_lat IS 'Student latitude when marking attendance';
COMMENT ON COLUMN public.attendance_records.student_lng IS 'Student longitude when marking attendance';
COMMENT ON COLUMN public.attendance_records.distance_from_teacher_meters IS 'Calculated distance between teacher and student';
COMMENT ON COLUMN public.attendance_records.location_verified IS 'Whether student was within allowed radius';
