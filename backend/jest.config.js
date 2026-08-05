module.exports = {
  testEnvironment: 'node',
  // Loaded before the modules under test so DATABASE_URL/JWT secrets point at
  // the throwaway test database rather than the developer's .env.
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    // Bootstraps the HTTP listener and signal handlers; the app it starts is
    // covered through supertest in every suite.
    '!src/server.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  testTimeout: 30000,
  clearMocks: true,
};
