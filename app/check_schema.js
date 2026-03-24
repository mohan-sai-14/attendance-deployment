const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Checking "users" table columns...');
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(1);
    
  if (usersError) {
    console.error('Error fetching from users table:', usersError);
  } else if (usersData && usersData.length > 0) {
    console.log('Columns found in "users" table:', Object.keys(usersData[0]));
  }
  
  console.log('Checking if "face_embeddings" table exists...');
  const { data: feData, error: feError } = await supabase
    .from('face_embeddings')
    .select('*')
    .limit(1);
    
  if (feError) {
    console.log('"face_embeddings" table error (might not exist):', feError.message);
  } else {
    console.log('"face_embeddings" table exists. Columns:', feData.length > 0 ? Object.keys(feData[0]) : 'No rows to check columns');
  }
}

checkSchema();
