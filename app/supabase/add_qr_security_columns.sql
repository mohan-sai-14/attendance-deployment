-- Add qr_secret column to sessions table for rotating QR token validation
-- Also add teacher_ip column for IP-based verification (Phase 2)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_secret TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_ip TEXT;
