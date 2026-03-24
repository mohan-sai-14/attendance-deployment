const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const envPath = path.resolve(__dirname, './.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        console.log('Checking notifications table columns by attempting an insert with a dummy object...');
        const { error: insertError } = await supabase
            .from('notifications')
            .insert([{ non_existent_column_to_trigger_error: 'test' }]);
        
        console.log('Error hint should contain column info:', insertError?.message);
        
        // Also check if we can select
        const { data, error: selectError } = await supabase.from('notifications').select('*').limit(1);
        if (data && data.length > 0) {
            console.log('Found data, columns:', Object.keys(data[0]));
        } else {
            console.log('No data found to check columns by selection');
        }
    } catch (e) {
        console.error('Caught error:', e.message);
    }
}
check();
