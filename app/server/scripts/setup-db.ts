import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath, override: true });
console.log(`Loading environment from: ${envPath}`);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or service role key in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupDatabase() {
  console.log('Starting database setup...');

  try {
    // Enable Row Level Security on all tables
    console.log('Enabling Row Level Security on tables...');
    await Promise.all([
      supabase.rpc('enable_rls_on_table', { table_name: 'students' }),
      supabase.rpc('enable_rls_on_table', { table_name: 'faculty' }),
      supabase.rpc('enable_rls_on_table', { table_name: 'courses' }),
      supabase.rpc('enable_rls_on_table', { table_name: 'sessions' }),
      supabase.rpc('enable_rls_on_table', { table_name: 'attendance' }),
      supabase.rpc('enable_rls_on_table', { table_name: 'leave_requests' }),
      supabase.rpc('enable_rls_on_table', { table_name: 'holidays' })
    ]);

    // Create the update_updated_at_column function if it doesn't exist
    console.log('Creating update_updated_at_column function...');
    await supabase.rpc(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Run the migrations
    console.log('Running migrations...');
    
    // 0002_create_attendance_schema.sql
    console.log('Running migration 0002_create_attendance_schema...');
    await supabase.rpc(`
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
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create triggers for updated_at columns
    console.log('Creating triggers...');
    await supabase.rpc(`
      -- Update updated_at triggers
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
    `);

    // 0003_add_absent_students_function.sql
    console.log('Running migration 0003_add_absent_students_function...');
    await supabase.rpc(`
      -- Function to mark absent students for a session
      CREATE OR REPLACE FUNCTION mark_absent_students(session_id UUID)
      RETURNS void AS $$
      DECLARE
        session_record RECORD;
      BEGIN
        -- Get session details
        SELECT * INTO session_record FROM public.sessions WHERE id = session_id;
        
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Session not found';
        END IF;

        -- Mark students as absent who haven't checked in
        INSERT INTO public.attendance (session_id, student_id, status, marked_at)
        SELECT 
          session_id, 
          s.id, 
          'absent',
          NOW()
        FROM public.students s
        WHERE NOT EXISTS (
          SELECT 1 
          FROM public.attendance a 
          WHERE a.session_id = mark_absent_students.session_id 
          AND a.student_id = s.id
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    console.log('Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
