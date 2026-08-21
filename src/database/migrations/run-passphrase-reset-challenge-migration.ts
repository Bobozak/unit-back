import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

dotenv.config();

async function runPassphraseResetChallengeMigration() {
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
    '20260717170000-passphrase-reset-challenge.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.connect();

  try {
    await client.query(sql);
    console.log('Passphrase reset challenge migration completed successfully');
  } finally {
    await client.end();
  }
}

void runPassphraseResetChallengeMigration().catch((error) => {
  console.error('Passphrase reset challenge migration failed:', error.message);
  process.exit(1);
});
