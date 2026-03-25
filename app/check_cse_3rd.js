const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSecs() {
  const { data, error } = await supabase
    .from('users')
    .select('section')
    .eq('role', 'student')
    .eq('department', 'CSE')
    .eq('year', '3RD');

  if (error) console.error(error);
  else {
    const secs = [...new Set(data.map(x => x.section))];
    console.log('Sections for CSE 3RD:', secs);
  }
}

checkSecs();
