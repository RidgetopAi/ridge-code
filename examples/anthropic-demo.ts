#!/usr/bin/env npx ts-node

import { AnthropicClient } from '../src/models/AnthropicClient';
import { ConfigManager } from '../src/core/ConfigManager';
import { ConversationContext } from '../src/types';

/**
 * Demo script for AnthropicClient functionality
 * 
 * Prerequisites:
 * 1. Run: ridge-code config init
 * 2. Set API key: ridge-code config set models.anthropic.apiKey YOUR_KEY
 */

async function demonstrateStreamingResponse() {
  console.log('🚀 AnthropicClient Streaming Demo\n');
  
  const client = new AnthropicClient();
  
  try {
    // Initialize client with config
    await client.init();
    console.log('✅ Client initialized successfully\n');
    
    // Simple streaming message
    console.log('📝 Sending streaming message...\n');
    console.log('Response:');
    console.log('---------');
    
    for await (const chunk of client.sendMessage('Explain TypeScript generics in 2 sentences.')) {
      process.stdout.write(chunk);
    }
    
    console.log('\n');
    console.log('---------\n');
    
    // Show usage stats
    const stats = client.getUsageStats();
    console.log('📊 Usage Statistics:');
    console.log(`   Total Requests: ${stats.totalRequests}`);
    console.log(`   Successful: ${stats.successfulRequests}`);
    console.log(`   Failed: ${stats.failedRequests}`);
    console.log(`   Input Tokens: ${stats.totalInputTokens}`);
    console.log(`   Output Tokens: ${stats.totalOutputTokens}`);
    console.log(`   Estimated Cost: $${stats.totalCost.toFixed(4)}`);
    console.log(`   Avg Response Time: ${stats.averageResponseTime}ms`);
    console.log(`   Rate Limit Hits: ${stats.rateLimitHits}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function demonstrateCompleteResponse() {
  console.log('🔄 AnthropicClient Complete Response Demo\n');
  
  const client = new AnthropicClient();
  
  try {
    await client.init();
    
    const response = await client.sendMessageComplete('What is the capital of France?');
    console.log('Complete Response:', response);
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function demonstrateConversationContext() {
  console.log('💬 AnthropicClient Conversation Context Demo\n');
  
  const client = new AnthropicClient();
  
  try {
    await client.init();
    
    // Build a conversation context
    const context: ConversationContext = {
      messages: [
        { role: 'system', content: 'You are a helpful coding assistant.' },
        { role: 'user', content: 'What is a closure in JavaScript?' },
        { role: 'assistant', content: 'A closure is a function that has access to variables in its outer (enclosing) scope even after the outer function has returned.' },
      ],
      systemPrompt: 'You are a helpful coding assistant. Keep responses concise.',
      maxTokens: 500,
      temperature: 0.3,
    };
    
    console.log('📝 Asking follow-up question with context...\n');
    console.log('Response:');
    console.log('---------');
    
    for await (const chunk of client.sendMessage('Can you give me a simple example?', context)) {
      process.stdout.write(chunk);
    }
    
    console.log('\n---------\n');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function demonstrateErrorHandling() {
  console.log('⚠️  AnthropicClient Error Handling Demo\n');
  
  const client = new AnthropicClient();
  
  try {
    // Try to use client without proper initialization
    console.log('Testing without API key...');
    
    // Mock a client with invalid config
    const configManager = ConfigManager.getInstance();
    const originalGet = configManager.get.bind(configManager);
    configManager.get = jest.fn().mockResolvedValue('invalid-key');
    
    await client.init();
    
    // This should fail with authentication error
    await client.sendMessageComplete('Test message');
    
    // Restore original method
    configManager.get = originalGet;
    
  } catch (error: any) {
    console.log('✅ Caught expected error:', error.message);
    console.log('   Retryable:', error.retryable);
    console.log('   Rate Limited:', error.rateLimited);
    console.log();
  }
}

// Run the demos
async function main() {
  try {
    console.log('🎯 AnthropicClient Integration Tests\n');
    console.log('=' .repeat(50));
    
    await demonstrateStreamingResponse();
    await demonstrateCompleteResponse();
    await demonstrateConversationContext();
    await demonstrateErrorHandling();
    
    console.log('✅ All demos completed!\n');
    
  } catch (error) {
    console.error('💥 Demo failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}

export {
  demonstrateStreamingResponse,
  demonstrateCompleteResponse,
  demonstrateConversationContext,
  demonstrateErrorHandling,
};
