module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**/*.js',
    '!src/**/index.js'
  ],
  testMatch: [
    '**/src/tests/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js']
}; 