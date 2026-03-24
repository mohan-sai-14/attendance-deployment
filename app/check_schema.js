const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Checking "sessions" table columns...');
  const { data: sessData, error: sessError } = await supabase
    .from('sessions')
    .select('*')
    .limit(1);
    
  if (sessError) {
    console.error('Error fetching from sessions table:', sessError);
  } else if (sessData && sessData.length > 0) {
    console.log('Columns found in "sessions" table:', Object.keys(sessData[0]));
  }
}

checkSchema();
