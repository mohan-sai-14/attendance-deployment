const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  console.log('--- CLASSES ---');
  const { data: classes, error: classError } = await supabase.from('classes').select('*');
  if (classError) console.error(classError);
  else console.table(classes.map(c => ({ 
    id: c.id, 
    dept: c.department, 
    prog: c.program, 
    year: c.year, 
    sec: c.section 
  })));

  console.log('\n--- STUDENTS (First 10) ---');
  const { data: students, error: studentError } = await supabase
    .from('users')
    .select('username, name, department, program, year, section')
    .eq('role', 'student')
    .limit(10);
  
  if (studentError) console.error(studentError);
  else console.table(students);

  // Check unique values in users
  console.log('\n--- UNIQUE VALUES IN USERS (Students) ---');
  const { data: allStudents } = await supabase.from('users').select('department, program, year, section').eq('role', 'student');
  
  const unique = (arr) => [...new Set(arr)];
  console.log('Depts:', unique(allStudents.map(s => s.department)));
  console.log('Progs:', unique(allStudents.map(s => s.program)));
  console.log('Years:', unique(allStudents.map(s => s.year)));
  console.log('Secs:', unique(allStudents.map(s => s.section)));
}

checkData();
