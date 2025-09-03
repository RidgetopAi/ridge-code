#!/usr/bin/env node

import { CommandRouter } from './src/core/CommandRouter';
import { ResponseBuffer } from './src/response/ResponseBuffer';
import { AidisMcpClient } from './src/aidis/AidisMcpClient';
import { ResponseMetadata } from './src/types';

async function testCommandRouter() {
  console.log('🚀 Testing CommandRouter Integration...\n');

  // Initialize components
  const responseBuffer = new ResponseBuffer();
  const aidisClient = new AidisMcpClient({
    baseUrl: 'http://localhost:8080' // AIDIS server URL
  });
  
  const commandRouter = new CommandRouter(responseBuffer, aidisClient);

  // Test 1: Help command
  console.log('📋 Test 1: /help command');
  const helpResult = await commandRouter.routeCommand('/help');
  console.log(`Success: ${helpResult.success}`);
  console.log(`Type: ${helpResult.commandType}`);
  if (helpResult.output) {
    console.log('Output:\n', helpResult.output.substring(0, 200) + '...');
  }
  console.log('---\n');

  // Test 2: AIDIS ping command  
  console.log('🏓 Test 2: /aidis_ping command');
  try {
    const pingResult = await commandRouter.routeCommand('/aidis_ping');
    console.log(`Success: ${pingResult.success}`);
    console.log(`Type: ${pingResult.commandType}`);
    console.log(`Output: ${pingResult.output || pingResult.error}`);
  } catch (error) {
    console.log(`Error connecting to AIDIS: ${error}`);
  }
  console.log('---\n');

  // Test 3: Shell command (safe)
  console.log('🔧 Test 3: Shell command (echo test)');
  const shellResult = await commandRouter.routeCommand('echo "CommandRouter test successful"');
  console.log(`Success: ${shellResult.success}`);
  console.log(`Type: ${shellResult.commandType}`);
  console.log(`Output: ${shellResult.output}`);
  console.log('---\n');

  // Test 4: Dangerous command (blocked)
  console.log('⚠️  Test 4: Dangerous command (blocked)');
  const dangerousResult = await commandRouter.routeCommand('rm -rf test');
  console.log(`Success: ${dangerousResult.success}`);
  console.log(`Type: ${dangerousResult.commandType}`);
  console.log(`Error: ${dangerousResult.error}`);
  console.log('---\n');

  // Test 5: AIDIS store commands (with mock response data)
  console.log('💾 Test 5: /aidis_store --context command');
  
  // Add mock response with AIDIS command to buffer
  const mockResponse = `Here's how to implement authentication:
  
  mcp__aidis__context_store {"content": "Authentication implementation details", "type": "code", "tags": ["auth", "implementation"]}
  
  This should help with your project.`;
  
  const mockMetadata: ResponseMetadata = {
    model: 'test-model',
    tokenCount: 150,
    responseTime: 1500
  };

  responseBuffer.addResponse(mockResponse, mockMetadata);

  try {
    const storeResult = await commandRouter.routeCommand('/aidis_store --context');
    console.log(`Success: ${storeResult.success}`);
    console.log(`Type: ${storeResult.commandType}`);
    console.log(`Output: ${storeResult.output || storeResult.error}`);
  } catch (error) {
    console.log(`Error executing store command: ${error}`);
  }
  console.log('---\n');

  // Test 6: Response buffer statistics
  console.log('📊 Test 6: Response Buffer Statistics');
  const stats = responseBuffer.getStats();
  console.log('Buffer Stats:', {
    totalResponses: stats.totalResponses,
    totalContentLength: stats.totalContentLength,
    averageResponseTime: Math.round(stats.averageResponseTime)
  });

  console.log('\n✅ CommandRouter integration tests completed!');
  
  // Clean disconnect
  if (aidisClient.isConnected()) {
    aidisClient.disconnect();
  }
}

// Run the test
testCommandRouter().catch(console.error);
