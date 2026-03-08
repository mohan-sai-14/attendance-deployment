import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
   const { data, error } = await supabase.from('sessions').insert({
      name: "Test Class - P1",
      date: "2026-03-02",
      time: "09:00",
      duration: 50,
      qr_code: "{}",
      expires_at: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      is_active: true,
      teacher_lat: 12.0,
      teacher_lng: 79.0,
      allowed_radius_meters: 150,
      class_id: "76157995-1234-a6b1-0bcd-123456789abc", // Dummy uuid
      section: "A"
   }).select().single();

   if (error) {
      fs.writeFileSync('error_out2.txt', JSON.stringify(error, null, 2));
      console.log("Error:", error);
   } else {
      fs.writeFileSync('error_out2.txt', "SUCCESS");
      console.log("Success:", data);
      await supabase.from('sessions').delete().eq('id', data.id);
   }
}

testInsert();
