const path = require('path');

// `override: true` so .env.test wins over a developer's .env, which points at
// the real development database.
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env.test'),
  override: true,
});

process.env.NODE_ENV = 'test';
