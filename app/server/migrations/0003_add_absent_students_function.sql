-- Function to get students who haven't marked attendance for a session
CREATE OR REPLACE FUNCTION public.get_absent_students(p_session_id UUID)
RETURNS TABLE (
  id UUID,
  roll_number TEXT,
  full_name TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.roll_number, s.full_name, s.email
  FROM public.students s
  WHERE NOT EXISTS (
    SELECT 1 
    FROM public.attendance a 
    WHERE a.student_id = s.id 
    AND a.session_id = p_session_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the function
GRANT EXECUTE ON FUNCTION public.get_absent_students(UUID) TO anon, authenticated, service_role;
