const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testLogin() {
  console.log("Fetching admin user...");
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', 'admin')
    .single();

  if (error) {
    console.error("DB Error:", error);
    return;
  }

  console.log("Admin User found!");
  console.log("Password in DB:", user.password);
  
  const isLegacy = !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$');
  console.log("Is Legacy Plaintext?", isLegacy);

  if (!isLegacy) {
    const isValid = await bcrypt.compare("admin123", user.password);
    console.log("bcrypt.compare('admin123', hash) =", isValid);
  } else {
    console.log("Plaintext compare('admin123') =", user.password === 'admin123');
  }
}

testLogin().catch(console.error);
