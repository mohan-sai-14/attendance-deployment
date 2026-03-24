const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://cbtlnniotuvdfwydrmzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ1OTI4NiwiZXhwIjoyMDcyMDM1Mjg2fQ.7vanSwHUiV5AwcF7HOKASqcMVEWwSMD5PMAJRPDd12A'
);

async function check(usernames) {
  const { data, error } = await supabase
    .from('users')
    .select('username, name, face_enrollment_status, face_embeddings')
    .in('username', usernames);

  if (error) {
    console.error(error);
  } else {
    data.forEach(user => {
      console.log(`User: ${user.username} | Status: ${user.face_enrollment_status} | Has Embeddings: ${!!user.face_embeddings}`);
    });
  }
}

const usernames = process.argv.slice(2);
if (usernames.length > 0) {
  check(usernames);
} else {
  console.log("Provide usernames as arguments");
}
