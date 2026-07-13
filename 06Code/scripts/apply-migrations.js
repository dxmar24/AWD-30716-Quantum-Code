const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is required to apply database migrations.');
  process.exit(1);
}

const migrationsPath = path.resolve(__dirname, '..', 'migrations');
const migrationFiles = fs.readdirSync(migrationsPath)
  .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(name))
  .sort((left, right) => left.localeCompare(right));

if (!migrationFiles.length) {
  console.error('No SQL migrations were found.');
  process.exit(1);
}

const checksum = (sql) => crypto.createHash('sha256').update(sql).digest('hex');
const statusOnly = process.argv.includes('--status');

async function main() {
  const pool = new Pool({ connectionString:databaseUrl, max:1 });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [30716]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const appliedRows = await client.query('SELECT name, checksum, applied_at FROM schema_migrations ORDER BY name');
    const applied = new Map(appliedRows.rows.map((row) => [row.name, row]));

    for (const name of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsPath, name), 'utf8');
      const digest = checksum(sql);
      const previous = applied.get(name);
      if (previous && previous.checksum !== digest) {
        throw new Error(`Migration checksum mismatch: ${name}. Applied migrations are immutable.`);
      }
      if (statusOnly) {
        console.log(`${previous ? 'applied' : 'pending'} ${name}`);
        continue;
      }
      if (previous) continue;

      console.log(`Applying ${name}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [name, digest],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    if (!statusOnly) console.log(`Database migrations are current (${migrationFiles.length} files).`);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [30716]); } catch { /* Connection cleanup still runs. */ }
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
