import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { parse } from 'pg-connection-string';

dotenv.config();

async function runPassphraseChangeChallengeRateLimitMigration() {
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
    '20260818100000-passphrase-change-challenge-rate-limit.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.connect();

  try {
    await client.query(sql);
    console.log(
      'Passphrase change challenge rate-limit migration completed successfully',
    );
  } finally {
    await client.end();
  }
}

void runPassphraseChangeChallengeRateLimitMigration().catch((error) => {
  console.error(
    'Passphrase change challenge rate-limit migration failed:',
    error.message,
  );
  process.exit(1);
});
