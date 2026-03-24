import { storage } from "../src/storage";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  console.log("Starting password hashing migration...");
  const users = await storage.getAllUsers();
  
  let migrated = 0;
  for (const user of users) {
    if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
      console.log(`Hashing password for user: ${user.username}`);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);
      await storage.supabase.from('users').update({ password: hashedPassword }).eq('id', user.id);
      migrated++;
    }
  }
  
  console.log(`Migration complete. ${migrated} users securely hashed.`);
  process.exit(0);
}

run().catch(console.error);
