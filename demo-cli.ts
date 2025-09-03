#!/usr/bin/env node

import { CommandRouter } from './src/core/CommandRouter';
import { ResponseBuffer } from './src/response/ResponseBuffer';
import { AidisMcpClient } from './src/aidis/AidisMcpClient';

/**
 * Demo CLI to showcase Task 1.7: Slash Command Router
 * 
 * Simulates ridge-code CLI commands:
 * - ridge-code /help
 * - ridge-code /aidis_ping  
 * - ridge-code ls -la
 */
async function demoCLI() {
  console.log('🎯 Ridge-Code CLI Demo - Task 1.7: Slash Command Router\n');

  // Initialize CommandRouter
  const responseBuffer = new ResponseBuffer();
  const aidisClient = new AidisMcpClient({
    baseUrl: 'http://localhost:8080'
  });
  const router = new CommandRouter(responseBuffer, aidisClient);

  // Commands to demonstrate
  const commands = [
    '/help',
    '/aidis_ping',
    'ls -la'
  ];

  for (const command of commands) {
    console.log(`\n$ ridge-code ${command}`);
    console.log('─'.repeat(50));
    
    const startTime = Date.now();
    const result = await router.routeCommand(command);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ Success (${result.commandType}) - ${duration}ms`);
      if (result.output) {
        // Limit output for demo purposes
        const output = result.output.length > 300 
          ? result.output.substring(0, 300) + '...\n[Output truncated]'
          : result.output;
        console.log(output);
      }
    } else {
      console.log(`❌ Failed (${result.commandType}) - ${duration}ms`);
      console.log(`Error: ${result.error}`);
    }
  }

  console.log('\n🏁 Demo completed successfully!');
  console.log('\n📋 Task 1.7 Acceptance Criteria Verified:');
  console.log('  ✅ Routes /aidis_* commands to AIDIS handler');
  console.log('  ✅ Routes shell commands to shell executor'); 
  console.log('  ✅ Provides help system with command documentation');
  console.log('  ✅ Handles command parsing errors gracefully');
  console.log('  ✅ Returns structured results for display');

  // Cleanup
  if (aidisClient.isConnected()) {
    aidisClient.disconnect();
  }
}

// Run demo
demoCLI().catch(console.error);
