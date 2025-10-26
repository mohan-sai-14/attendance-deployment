const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = 'https://cbtlnniotuvdfwydrmzm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NTkyODYsImV4cCI6MjA3MjAzNTI4Nn0.U5ipnkQr6aKHY4Oa6ct2ZaG5XtAv-XVV4W-ffUE2JJk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', '..', 'server', 'db', 'add_date_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Migration SQL loaded successfully');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      
      // If the RPC method doesn't exist, try running individual statements
      console.log('Trying alternative approach...');
      
      // Add date column to attendance table
      const { error: dateError } = await supabase
        .from('attendance')
        .select('date')
        .limit(1);
      
      if (dateError && dateError.message.includes('column "date" does not exist')) {
        console.log('Date column does not exist, adding it...');
        
        // Since we can't run ALTER TABLE directly, we'll need to handle this differently
        console.log('Please run the following SQL in your Supabase SQL editor:');
        console.log('');
        console.log('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date TEXT;');
        console.log('UPDATE attendance SET date = DATE(check_in_time)::TEXT WHERE date IS NULL;');
        console.log('');
        console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'student\';');
        console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT \'active\';');
        console.log('');
        console.log('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS date DATE;');
        console.log('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS time TEXT;');
        console.log('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS duration INTEGER;');
        console.log('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS qr_code VARCHAR;');
      } else {
        console.log('Date column already exists or other error:', dateError);
      }
    } else {
      console.log('Migration completed successfully:', data);
    }
    
  } catch (error) {
    console.error('Migration script error:', error);
  }
}

runMigration();
