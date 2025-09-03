#!/usr/bin/env ts-node

/**
 * Comprehensive test suite for Ridge-Code CLI
 * Tests all core functionality and integration points
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as path from 'path';

const execAsync = promisify(exec);

// Test configuration
const CLI_PATH = path.join(__dirname, 'bin', 'ridge-code.js');
const testResults: Array<{ name: string; passed: boolean; error?: string }> = [];

/**
 * Run a test and record the result
 */
async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    console.log(chalk.blue(`◐ Testing: ${name}`));
    await testFn();
    testResults.push({ name, passed: true });
    console.log(chalk.green(`✓ ${name}`));
  } catch (error) {
    testResults.push({ 
      name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error)
    });
    console.log(chalk.red(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Test basic CLI functionality
 */
async function testBasicCLI(): Promise<void> {
  // Test version command
  const { stdout: version } = await execAsync(`${CLI_PATH} --version`);
  if (!version.trim().match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid version format');
  }

  // Test help command
  const { stdout: help } = await execAsync(`${CLI_PATH} --help`);
  if (!help.includes('CLI tool for cost-effective AIDIS interactions')) {
    throw new Error('Help text not found');
  }
}

/**
 * Test configuration management
 */
async function testConfigManagement(): Promise<void> {
  // Initialize configuration
  const { stdout: initOutput } = await execAsync(`${CLI_PATH} config init`);
  if (!initOutput.includes('Configuration initialized')) {
    throw new Error('Config init failed');
  }

  // Test setting configuration
  await execAsync(`${CLI_PATH} config set models.anthropic.model claude-3-5-sonnet-20241022`);
  
  // Test getting configuration
  const { stdout: getOutput } = await execAsync(`${CLI_PATH} config get models.anthropic.model`);
  if (!getOutput.includes('claude-3-5-sonnet-20241022')) {
    throw new Error('Config get/set failed');
  }
}

/**
 * Test AIDIS integration (without actual connection)
 */
async function testAidisIntegration(): Promise<void> {
  // Test AIDIS status (should work even without connection)
  const { stdout: statusOutput } = await execAsync(`${CLI_PATH} aidis status`);
  if (!statusOutput.includes('AIDIS Status:')) {
    throw new Error('AIDIS status command failed');
  }

  // Test AIDIS ping (will fail but should handle gracefully)
  try {
    await execAsync(`${CLI_PATH} aidis ping`);
  } catch (error: any) {
    // This is expected to fail, but should not crash
    if (!error.stdout && !error.stderr) {
      throw new Error('AIDIS ping crashed unexpectedly');
    }
  }
}

/**
 * Test the chat command without API key (should fail gracefully)
 */
async function testChatWithoutApiKey(): Promise<void> {
  try {
    const { stderr } = await execAsync(`${CLI_PATH} chat "Hello test"`);
    // Should fail gracefully with appropriate error message
    if (!stderr.includes('API key not configured') && !stderr.includes('Configuration file not found')) {
      // If it gets further than config validation, that's also OK
      if (!stderr.includes('Failed to initialize') && !stderr.includes('Error')) {
        throw new Error('Chat command did not fail gracefully');
      }
    }
  } catch (error: any) {
    // Expected to fail, but should be a graceful failure
    if (error.code !== 1) {
      throw new Error('Chat command crashed unexpectedly');
    }
  }
}

/**
 * Test response buffer and command router integration
 */
async function testComponentIntegration(): Promise<void> {
  // Import and test individual components
  const { ResponseBuffer } = await import('./src/response/ResponseBuffer');
  const { CommandRouter } = await import('./src/core/CommandRouter');
  const { AidisMcpClient } = await import('./src/aidis/AidisMcpClient');
  
  // Test response buffer
  const responseBuffer = new ResponseBuffer();
  responseBuffer.addResponse('Test response content');
  
  if (responseBuffer.size !== 1) {
    throw new Error('ResponseBuffer not working correctly');
  }
  
  const recentResponses = responseBuffer.getRecentResponses(1);
  if (recentResponses.length !== 1 || !recentResponses[0] || !recentResponses[0].content.includes('Test response content')) {
    throw new Error('ResponseBuffer retrieval not working');
  }

  // Test command router with mock AIDIS client
  const aidisClient = new AidisMcpClient({ baseUrl: 'http://localhost:8080' });
  const commandRouter = new CommandRouter(responseBuffer, aidisClient);
  
  // Test help command
  const helpResult = await commandRouter.routeCommand('/help');
  if (!helpResult.success || !(helpResult.output && helpResult.output.includes('Ridge-Code CLI Commands'))) {
    throw new Error('CommandRouter help not working');
  }

  // Test shell command
  const shellResult = await commandRouter.routeCommand('echo "test shell command"');
  if (!shellResult.success || !(shellResult.output && shellResult.output.includes('test shell command'))) {
    throw new Error('CommandRouter shell execution not working');
  }
}

/**
 * Test error handling and edge cases
 */
async function testErrorHandling(): Promise<void> {
  // Test invalid commands
  try {
    await execAsync(`${CLI_PATH} invalid-command`);
  } catch (error: any) {
    if (error.code !== 1) {
      throw new Error('Invalid command did not exit with code 1');
    }
  }

  // Test invalid config operations
  try {
    await execAsync(`${CLI_PATH} config invalid-action`);
  } catch (error: any) {
    if (!(error.stderr && error.stderr.includes('Unknown config action'))) {
      throw new Error('Invalid config action not handled properly');
    }
  }
}

/**
 * Test CLI building and packaging
 */
async function testBuildAndPackaging(): Promise<void> {
  // Test TypeScript build
  const { stdout: buildOutput } = await execAsync('npm run build');
  // Build should succeed (no specific output required)
  
  // Test that dist files exist
  const { stdout: distFiles } = await execAsync('ls -la dist/');
  if (!distFiles.includes('index.js')) {
    throw new Error('Build did not create index.js');
  }

  // Test lint
  try {
    await execAsync('npm run lint');
  } catch (error: any) {
    // Lint warnings are OK, crashes are not
    if (error.code > 1) {
      throw new Error('Lint command crashed');
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log(chalk.yellow('🧪 Ridge-Code CLI Comprehensive Test Suite'));
  console.log(chalk.yellow('============================================\n'));

  await runTest('Basic CLI Functionality', testBasicCLI);
  await runTest('Configuration Management', testConfigManagement);
  await runTest('AIDIS Integration', testAidisIntegration);
  await runTest('Chat Without API Key', testChatWithoutApiKey);
  await runTest('Component Integration', testComponentIntegration);
  await runTest('Error Handling', testErrorHandling);
  await runTest('Build and Packaging', testBuildAndPackaging);

  // Print summary
  console.log('\n' + chalk.yellow('Test Results Summary:'));
  console.log('===================');
  
  let passed = 0;
  let failed = 0;

  for (const result of testResults) {
    if (result.passed) {
      console.log(chalk.green(`✓ ${result.name}`));
      passed++;
    } else {
      console.log(chalk.red(`✗ ${result.name}: ${result.error}`));
      failed++;
    }
  }

  console.log(`\n${chalk.green(`Passed: ${passed}`)} | ${chalk.red(`Failed: ${failed}`)} | Total: ${testResults.length}`);
  
  if (failed === 0) {
    console.log(chalk.green('\n🎉 All tests passed! Ridge-Code CLI is ready for use.'));
  } else {
    console.log(chalk.yellow(`\n⚠️  ${failed} test(s) failed. Please review the errors above.`));
  }

  // Exit with appropriate code
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests if this is the main module
if (require.main === module) {
  runAllTests().catch(error => {
    console.error(chalk.red('Test runner crashed:'), error);
    process.exit(1);
  });
}

export { runAllTests };
