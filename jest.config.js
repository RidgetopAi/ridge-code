module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {}]
  },
  moduleNameMapper: {
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.js',
    '^cli-highlight$': '<rootDir>/tests/__mocks__/cli-highlight.js',
    '^cli-table3$': '<rootDir>/tests/__mocks__/cli-table3.js',
    '^@modelcontextprotocol/sdk/client/index.js$': '<rootDir>/tests/__mocks__/mcp-client.js'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
