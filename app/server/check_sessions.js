const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSessions() {
    const { data: users, error: userError } = await supabase.from('users').select('id, username');
    console.log('Users:', users);

    const { data: sessions, error: sessError } = await supabase.from('sessions').select('id, created_by, date').order('created_at', { ascending: false }).limit(10);
    console.log('Recent Sessions:', sessions);
}

checkSessions();
