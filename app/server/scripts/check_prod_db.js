const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables (from root or local)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

console.log('Script started...');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log('Environment constants:', {
  URL_EXISTS: !!supabaseUrl,
  KEY_EXISTS: !!supabaseKey,
  NODE_ENV: process.env.NODE_ENV
});

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing Supabase URL or API Key in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
  console.log('--- Database Diagnostics ---');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Using Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY' : 'ANON_KEY');
  
  try {
    // 1. Check if users table exists and list columns
    console.log('\n1. Checking "users" table...');
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (usersError) {
      console.error('Error querying "users" table:', usersError.message);
      if (usersError.message.includes('not found')) {
        console.log('HINT: Table "users" might not exist. Check if it should be "profiles" or "students".');
      }
    } else if (usersData && usersData.length > 0) {
      console.log('SUCCESS: Table "users" found.');
      console.log('Columns available:', Object.keys(usersData[0]));
      
      const hasEmbeddings = 'face_embeddings' in usersData[0];
      console.log('Has "face_embeddings" column:', hasEmbeddings ? 'YES' : 'NO');
      
      if (!hasEmbeddings) {
        console.log('HINT: Run app/database-updates.sql to add missing face embedding columns.');
      }
    } else {
      console.log('Table "users" exists but is empty.');
    }

    // 2. Check for student users
    console.log('\n2. Checking for student users...');
    const { data: students, error: studentsError } = await supabase
      .from('users')
      .select('id, username, role, face_enrollment_status')
      .eq('role', 'student')
      .limit(5);

    if (studentsError) {
      console.error('Error fetching students:', studentsError.message);
    } else {
      console.log('Found', students.length, 'students.');
      students.forEach(s => {
        console.log(`- ID: ${s.id}, Username: ${s.username}, Status: ${s.face_enrollment_status}`);
      });
    }

    // 3. Test update permission (simulated)
    if (students && students.length > 0) {
      console.log('\n3. Testing update permission (dry run - updating status to same value)...');
      const testStudent = students[0];
      const { error: updateError } = await supabase
        .from('users')
        .update({ face_enrollment_status: testStudent.face_enrollment_status })
        .eq('id', testStudent.id);

      if (updateError) {
        console.error('PERMISSION ERROR: Failed to update user.', updateError.message);
        if (updateError.message.includes('policy') || updateError.message.includes('Rows not found')) {
          console.log('HINT: Row Level Security (RLS) is likely blocking this update because you are using an ANON_KEY instead of a SERVICE_ROLE_KEY.');
        }
      } else {
        console.log('SUCCESS: Permission to update user verified.');
      }
    }

  } catch (err) {
    console.error('Unexpected error during diagnostics:', err.message);
  }
}

diagnostic();
