const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkEnrollment() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Checking for enrolled students...');
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, face_enrollment_status, face_embeddings')
    .eq('face_enrollment_status', 'enrolled');
    
  if (error) {
    console.error('Error fetching from users table:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log(`Found ${data.length} enrolled students.`);
    data.forEach(u => {
      console.log(`- ID=${u.id}, Username=${u.username}: status=${u.face_enrollment_status}, embeddings=${!!u.face_embeddings}, type=${typeof u.face_embeddings}, isArray=${Array.isArray(u.face_embeddings)}`);
    });
  } else {
    console.log('No students with "enrolled" status found.');
  }
}

checkEnrollment();
