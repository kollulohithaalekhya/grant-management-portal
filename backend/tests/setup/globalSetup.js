const path = require('path');
const { execFileSync } = require('child_process');

require('./env');

// Resolved to the installed CLI entrypoint and run through the current Node
// binary — `npx` would need a shell on Windows and adds a lookup per run.
const prismaCli = require.resolve('prisma/build/index.js');

/** Splits a connection string into the target database name and an admin URL. */
const parseDatabaseUrl = (url) => {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.searchParams.delete('schema');
  return { database, adminUrl: adminUrl.toString() };
};

/**
 * Creates the test database when it is missing, so a clean checkout only needs
 * a running PostgreSQL (`npm run test:db:up`) and nothing else.
 */
const ensureDatabaseExists = async (databaseUrl) => {
  const { PrismaClient } = require('@prisma/client');
  const { database, adminUrl } = parseDatabaseUrl(databaseUrl);

  const probe = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await probe.$queryRaw`SELECT 1`;
    return;
  } catch {
    // Fall through and try to create it.
  } finally {
    await probe.$disconnect();
  }

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
  } catch (err) {
    // 42P04 = duplicate_database: another worker won the race, which is fine.
    if (!/already exists/i.test(err.message)) {
      throw new Error(
        `Could not create the test database "${database}".\n` +
          'Is PostgreSQL running? Start it with: npm run test:db:up\n\n' +
          err.message
      );
    }
  } finally {
    await admin.$disconnect();
  }
};

/** Empties every table except the immutable role catalogue. */
const truncateData = async (databaseUrl) => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "notifications", "refresh_tokens", "applications", "grants", "user_roles", "users" RESTART IDENTITY CASCADE'
    );
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Brings the throwaway test database up to date with the committed migrations.
 * `migrate deploy` only applies pending migrations — it never drops data — so
 * the suite starts from a schema identical to production.
 */
module.exports = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set — check backend/.env.test');
  }

  await ensureDatabaseExists(databaseUrl);

  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'pipe',
      env: { ...process.env, CHECKPOINT_DISABLE: '1' },
    });
  } catch (err) {
    const details = [err.stdout, err.stderr].filter(Boolean).map(String).join('\n');
    throw new Error(`Failed to migrate the test database (${databaseUrl}).\n\n${details}`);
  }

  await truncateData(databaseUrl);
};
