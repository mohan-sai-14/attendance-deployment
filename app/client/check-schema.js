import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
   const { data, error } = await supabase.from('sessions').select('*').limit(1);
   if (data && data.length > 0) {
      console.log("COLUMNS:", Object.keys(data[0]).join(', '));
   } else {
      console.log("NO DATA OR ERROR", error);
   }
}

checkSchema();
