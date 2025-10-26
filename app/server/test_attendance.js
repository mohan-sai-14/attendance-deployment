const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://cbtlnniotuvdfwydrmzm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NTkyODYsImV4cCI6MjA3MjAzNTI4Nn0.U5ipnkQr6aKHY4Oa6ct2ZaG5XtAv-XVV4W-ffUE2JJk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAttendance() {
  try {
    console.log('Testing attendance functionality...');
    
    // First, check if the date column exists
    const { data: columns, error: columnError } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);
    
    if (columnError) {
      console.error('Error checking attendance table:', columnError);
      return;
    }
    
    console.log('Attendance table structure:', Object.keys(columns[0] || {}));
    
    // Check if we have any sessions
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionError) {
      console.error('Error checking sessions table:', sessionError);
      return;
    }
    
    console.log('Sessions table structure:', Object.keys(sessions[0] || {}));
    
    // Check if we have any users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (userError) {
      console.error('Error checking users table:', userError);
      return;
    }
    
    console.log('Users table structure:', Object.keys(users[0] || {}));
    
    console.log('\n✅ Database tables are accessible');
    console.log('\nNext steps:');
    console.log('1. Run the SQL commands from server/db/fix_attendance_table.sql in your Supabase SQL editor');
    console.log('2. Restart your server application');
    console.log('3. Try recording attendance again');
    
  } catch (error) {
    console.error('Test script error:', error);
  }
}

testAttendance();
