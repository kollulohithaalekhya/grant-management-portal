const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data';

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

const db = {
  users: Datastore.create({
    filename: path.join(DB_PATH, 'users.db'),
    autoload: true,
  }),
  grants: Datastore.create({
    filename: path.join(DB_PATH, 'grants.db'),
    autoload: true,
  }),
  applications: Datastore.create({
    filename: path.join(DB_PATH, 'applications.db'),
    autoload: true,
  }),
  notifications: Datastore.create({
    filename: path.join(DB_PATH, 'notifications.db'),
    autoload: true,
  }),
  refreshTokens: Datastore.create({
    filename: path.join(DB_PATH, 'refresh_tokens.db'),
    autoload: true,
  }),
};

// Create indexes
const initIndexes = async () => {
  await db.users.ensureIndex({ fieldName: 'email', unique: true });
  await db.grants.ensureIndex({ fieldName: 'createdAt' });
  await db.applications.ensureIndex({ fieldName: 'grantId' });
  await db.applications.ensureIndex({ fieldName: 'applicantId' });
  await db.notifications.ensureIndex({ fieldName: 'userId' });
  await db.refreshTokens.ensureIndex({ fieldName: 'token', unique: true });
  await db.refreshTokens.ensureIndex({ fieldName: 'userId' });
};

initIndexes().catch(console.error);

module.exports = db;
