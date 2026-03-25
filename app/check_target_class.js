const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificClass() {
  console.log('--- TARGET CLASS ---');
  const { data: classes, error: classError } = await supabase
    .from('classes')
    .select('*')
    .eq('program', 'B.TECH')
    .eq('department', 'CSE')
    .eq('year', '3RD');
  
  if (classError) console.error(classError);
  else console.log(JSON.stringify(classes, null, 2));

  console.log('\n--- POTENTIAL STUDENTS (CSE Year 3RD) ---');
  const { data: students, error: studentError } = await supabase
    .from('users')
    .select('username, name, department, program, year, section')
    .eq('role', 'student')
    .ilike('department', '%CSE%')
    .ilike('year', '%3%');
  
  if (studentError) console.error(studentError);
  else console.log(JSON.stringify(students, null, 2));
}

checkSpecificClass();
