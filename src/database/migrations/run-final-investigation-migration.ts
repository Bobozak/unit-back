import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

dotenv.config();

async function runFinalInvestigationMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const dbConfig = parse(connectionString);
  const isLocalHost =
    dbConfig.host === 'localhost' || dbConfig.host === '127.0.0.1';

  const client = new Client({
    connectionString,
    ...(isLocalHost ? {} : { ssl: { rejectUnauthorized: false } }),
  });

  const sqlPath = path.join(
    __dirname,
    '20260817160000-final-investigation.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.connect();

  try {
    await client.query(sql);
    console.log('Final investigation migration completed successfully');
  } finally {
    await client.end();
  }
}

void runFinalInvestigationMigration().catch((error) => {
  console.error('Final investigation migration failed:', error.message);
  process.exit(1);
});
