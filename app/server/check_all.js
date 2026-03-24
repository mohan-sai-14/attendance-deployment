const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cbtlnniotuvdfwydrmzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ1OTI4NiwiZXhwIjoyMDcyMDM1Mjg2fQ.7vanSwHUiV5AwcF7HOKASqcMVEWwSMD5PMAJRPDd12A'
);

async function check() {
  const { data, error } = await supabase
    .from('attendance')
    .select('*');

  if (error) {
    console.error(error);
  } else {
    console.log("Rows count:", data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
