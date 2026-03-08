import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
   const sessionId = "123e4567-e89b-12d3-a456-426614174000";
   const { data, error } = await supabase.from('sessions').insert({
      id: sessionId,
      name: "Test Session",
      date: "2026-03-02",
      time: "10:00",
      duration: 50,
      qr_code: "{}",
      expires_at: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      is_active: true,
      teacher_lat: 12.0,
      teacher_lng: 79.0,
      allowed_radius_meters: 150
   });

   if (error) {
      fs.writeFileSync('error_out.txt', JSON.stringify(error, null, 2));
   } else {
      fs.writeFileSync('error_out.txt', "SUCCESS");
      await supabase.from('sessions').delete().eq('id', sessionId);
   }
}

testInsert();
