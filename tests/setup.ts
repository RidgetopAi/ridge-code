// Global test setup
import * as path from 'path';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Handle async operations in tests
jest.setTimeout(10000);
