const { PrismaClient } = require('@prisma/client');
const config = require('../config');

// A single client per process. Nodemon/Jest reload the module graph, so the
// instance is cached on `globalThis` to avoid exhausting the connection pool.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__grantPortalPrisma ||
  new PrismaClient({
    log: config.env === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.env !== 'production') {
  globalForPrisma.__grantPortalPrisma = prisma;
}

module.exports = prisma;
