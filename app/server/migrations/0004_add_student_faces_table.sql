-- Enable Row Level Security on the new table if not already enabled
ALTER TABLE IF EXISTS public.student_faces ENABLE ROW LEVEL SECURITY;

-- Create the student_faces table
CREATE TABLE IF NOT EXISTS public.student_faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL REFERENCES public.students(roll_number) ON DELETE CASCADE,
  face_embedding JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, roll_number)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_student_faces_student_id ON public.student_faces(student_id);
CREATE INDEX IF NOT EXISTS idx_student_faces_roll_number ON public.student_faces(roll_number);

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_student_faces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE TRIGGER update_student_faces_updated_at_trigger
BEFORE UPDATE ON public.student_faces
FOR EACH ROW EXECUTE FUNCTION update_student_faces_updated_at();

-- Set up Row Level Security policies
-- Allow admins to do anything
CREATE POLICY "Enable all for admins" ON public.student_faces
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Allow students to read only their own face data
CREATE POLICY "Enable read access for own face data" ON public.student_faces
  FOR SELECT
  TO authenticated
  USING (
    roll_number = (
      SELECT raw_user_meta_data->>'roll_number' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Function to get or create a student face record
CREATE OR REPLACE FUNCTION public.upsert_student_face(
  p_student_id UUID,
  p_roll_number TEXT,
  p_face_embedding JSONB
)
RETURNS UUID AS $$
DECLARE
  v_face_id UUID;
BEGIN
  -- Try to update existing record
  UPDATE public.student_faces
  SET 
    face_embedding = p_face_embedding,
    updated_at = NOW()
  WHERE 
    student_id = p_student_id
    OR roll_number = p_roll_number
  RETURNING id INTO v_face_id;
  
  -- If no record was updated, insert a new one
  IF v_face_id IS NULL THEN
    INSERT INTO public.student_faces (student_id, roll_number, face_embedding)
    VALUES (p_student_id, p_roll_number, p_face_embedding)
    RETURNING id INTO v_face_id;
  END IF;
  
  RETURN v_face_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
