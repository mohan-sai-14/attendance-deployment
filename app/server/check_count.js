const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cbtlnniotuvdfwydrmzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NTkyODYsImV4cCI6MjA3MjAzNTI4Nn0.U5ipnkQr6aKHY4Oa6ct2ZaG5XtAv-XVV4W-ffUE2JJk'
);

async function check() {
  const { count, error } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(error);
  } else {
    console.log("Total attendance records:", count);
  }
}

check();
