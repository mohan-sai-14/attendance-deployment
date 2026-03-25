const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('department', 'CSE')
    .eq('year', '3RD');

  if (error) console.error(error);
  else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkClasses();
