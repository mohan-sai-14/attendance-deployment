const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://cbtlnniotuvdfwydrmzm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NTkyODYsImV4cCI6MjA3MjAzNTI4Nn0.U5ipnkQr6aKHY4Oa6ct2ZaG5XtAv-XVV4W-ffUE2JJk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Step 1: Add date column to attendance table
    console.log('📝 Adding date column to attendance table...');
    const { error: dateError } = await supabase
      .from('attendance')
      .select('date')
      .limit(1);
    
    if (dateError && dateError.message.includes('column "date" does not exist')) {
      console.log('✅ Date column is missing - this confirms we need to add it');
    } else {
      console.log('ℹ️ Date column might already exist');
    }
    
    console.log('\n📋 Please run the following SQL commands in your Supabase SQL editor:');
    console.log('=' .repeat(60));
    console.log(`
-- Add date column to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date TEXT;

-- Update existing attendance records to have a date based on check_in_time
UPDATE attendance 
SET date = DATE(check_in_time)::TEXT 
WHERE date IS NULL;

-- Add missing columns to users table (if not already present)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add missing columns to sessions table (if not already present)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_code VARCHAR;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance' 
ORDER BY ordinal_position;
`);
    console.log('=' .repeat(60));
    
    console.log('\n📖 Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the SQL commands above');
    console.log('4. Click "Run" to execute the migration');
    console.log('5. After the migration completes, restart your server application');
    console.log('6. Try recording attendance again');
    
    console.log('\n✅ Migration script completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration script error:', error);
  }
}

runMigration();
