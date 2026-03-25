const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('Starting migration of session owners...');
    const { data: users, error: userError } = await supabase.from('users').select('id, username');
    if (userError) {
        console.error('Error fetching users:', userError);
        return;
    }

    const userMap = new Map();
    users.forEach(u => userMap.set(u.username, String(u.id)));
    console.log('User map created:', userMap.size, 'users found.');

    const { data: sessions, error: sessError } = await supabase.from('sessions').select('id, created_by');
    if (sessError) {
        console.error('Error fetching sessions:', sessError);
        return;
    }

    console.log('Checking', sessions.length, 'sessions...');
    let migratedCount = 0;

    for (const session of sessions) {
        const owner = session.created_by;
        // If owner is a username (not a number)
        if (owner && isNaN(Number(owner)) && userMap.has(owner)) {
            const numericId = userMap.get(owner);
            const { error: updateError } = await supabase
                .from('sessions')
                .update({ created_by: numericId })
                .eq('id', session.id);
            
            if (updateError) {
                console.error(`Failed to migrate session ${session.id}:`, updateError);
            } else {
                migratedCount++;
            }
        }
    }

    console.log(`Migration complete. Migrated ${migratedCount} sessions.`);
}

migrate();
