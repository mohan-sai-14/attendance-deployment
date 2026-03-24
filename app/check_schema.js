const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Checking "attendance" table columns...');
  const { data: attData, error: attError } = await supabase
    .from('attendance')
    .select('*')
    .limit(1);
    
  if (attError) {
    console.error('Error fetching from attendance table:', attError);
  } else if (attData && attData.length > 0) {
    console.log('Columns found in "attendance" table:', Object.keys(attData[0]));
  }
}

checkSchema();
