const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function listAllUsers() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Listing all students...');
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, face_enrollment_status, face_embeddings')
    .eq('role', 'student');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  data.forEach(u => {
    console.log(`- ID=${u.id}, Username=${u.username}, Status=${u.face_enrollment_status}, HasEmbeddings=${!!u.face_embeddings}`);
  });
}

listAllUsers();
