const { Client } = require('pg');

async function createSessionTable() {
  const connectionString = 'postgresql://postgres:Mohansai%4014@db.cbtlnniotuvdfwydrmzm.supabase.co:5432/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to Supabase DB.');

    const query = `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
      
      -- Only add constraint if it doesn't exist
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
              ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT VALID;
          END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `;

    await client.query(query);
    console.log('Session table created successfully or already exists.');
  } catch (error) {
    console.error('Error creating session table:', error);
  } finally {
    await client.end();
  }
}

createSessionTable();
