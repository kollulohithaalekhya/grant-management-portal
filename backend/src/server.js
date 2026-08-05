const app = require('./app');
const config = require('./config');
const prisma = require('./lib/prisma');
const { store, usingRedis } = require('./lib/redis');

const server = app.listen(config.port, () => {
  console.log(`\n🚀 Grant Portal API running on http://localhost:${config.port}`);
  console.log(`📋 Environment: ${config.env}`);
  console.log(`🗄️  Database:    PostgreSQL (Prisma)`);
  console.log(`⚡ Cache:       ${usingRedis ? 'Redis' : 'in-process (REDIS_URL not set)'}`);
  console.log(`🔐 CORS origin: ${config.clientUrl}`);
  console.log(`🪪 Google OAuth: ${config.oauth.google.enabled ? 'enabled' : 'not configured'}\n`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down`);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), store.quit()]);
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
