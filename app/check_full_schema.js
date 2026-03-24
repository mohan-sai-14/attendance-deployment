const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL || 'https://cbtlnniotuvdfwydrmzm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ1OTI4NiwiZXhwIjoyMDcyMDM1Mjg2fQ.7vanSwHUiV5AwcF7HOKASqcMVEWwSMD5PMAJRPDd12A';

async function check(table) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log(`\nChecking "${table}" table columns...`);
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) {
    console.error(`Error fetching from ${table}:`, error.message);
  } else if (data && data.length > 0) {
    console.log(`Columns in "${table}":`, Object.keys(data[0]));
  } else {
    console.log(`No rows in "${table}" (cannot check columns)`);
  }
}

async function run() {
  await check('users');
  await check('attendance');
  await check('sessions');
  await check('timetables');
  await check('classes');
}
run();
