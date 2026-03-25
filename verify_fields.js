const { createClient } = require('@supabase/supabase-js');

// Using the credentials from check_users.js
const supabase = createClient(
  'https://cbtlnniotuvdfwydrmzm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNidGxubmlvdHV2ZGZ3eWRybXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NTkyODYsImV4cCI6MjA3MjAzNTI4Nn0.U5ipnkQr6aKHY4Oa6ct2ZaG5XtAv-XVV4W-ffUE2JJk'
);

async function check() {
  console.log("Checking database columns for 'users' table...");
  
  // Try to select one student to see all available columns
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Database query error:", error);
    process.exit(1);
  }

  if (users && users.length > 0) {
    const user = users[0];
    const columns = Object.keys(user);
    console.log("Available columns in 'users' table:", columns.join(', '));
    
    const requiredFields = ['enroll_no', 'registered_no', 'department', 'section', 'program', 'year'];
    const missingFields = requiredFields.filter(f => !columns.includes(f));
    
    if (missingFields.length > 0) {
      console.warn("WARNING: Missing columns in Supabase:", missingFields.join(', '));
    } else {
      console.log("SUCCESS: All required columns exist in Supabase.");
    }
  } else {
    console.log("No users found to check columns.");
  }

  // Test creating a student
  console.log("\nTesting student creation...");
  const testUsername = "T" + Math.floor(Math.random() * 100000);
  const testData = {
    username: testUsername,
    password: 'testPassword123',
    name: "Verification Student",
    email: "verify@example.com",
    role: "student",
    status: "active",
    enroll_no: "V_ENR_001",
    registered_no: "V_REG_001",
    department: "CSE",
    section: "B",
    program: "B.Tech",
    year: "3rd"
  };

  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert([testData])
    .select()
    .single();

  if (createError) {
    console.error("Failed to create user:", createError);
  } else {
    console.log("SUCCESS: Created user with new fields:", newUser.username);
    // Cleanup
    await supabase.from('users').delete().eq('id', newUser.id);
    console.log("Cleanup: Deleted verification student.");
  }
}

check();
