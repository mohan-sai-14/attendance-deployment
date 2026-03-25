const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupData() {
  console.log('Fetching all students...');
  const { data: students, error: fetchError } = await supabase
    .from('users')
    .select('id, department, program, year, section')
    .eq('role', 'student');

  if (fetchError) {
    console.error('Error fetching students:', fetchError);
    return;
  }

  console.log(`Processing ${students.length} students...`);
  let updatedCount = 0;

  for (const student of students) {
    const cleaned = {
      department: student.department ? student.department.replace(/[\r\n\t]+/g, '').trim() : null,
      program: student.program ? student.program.replace(/[\r\n\t]+/g, '').trim() : null,
      year: student.year ? student.year.replace(/[\r\n\t]+/g, '').trim() : null,
      section: student.section ? student.section.replace(/[\r\n\t]+/g, '').trim() : null,
    };

    // Only update if something changed
    if (
      cleaned.department !== student.department ||
      cleaned.program !== student.program ||
      cleaned.year !== student.year ||
      cleaned.section !== student.section
    ) {
      const { error: updateError } = await supabase
        .from('users')
        .update(cleaned)
        .eq('id', student.id);

      if (updateError) {
        console.error(`Error updating student ${student.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Cleanup complete. Updated ${updatedCount} student records.`);
}

cleanupData();
