#!/usr/bin/env ts-node

/**
 * Quick test to verify AnthropicProvider works correctly
 */

import { AnthropicProvider } from './src/models/AnthropicProvider';
import { ConfigManager } from './src/core/ConfigManager';

async function testAnthropicProvider() {
  console.log('🧪 Testing AnthropicProvider...');
  
  const configManager = ConfigManager.getInstance();
  await configManager.load();
  
  const apiKey = await configManager.get('models.anthropic.apiKey');
  if (!apiKey) {
    console.log('❌ No API key configured. Run: ridge-code config set models.anthropic.apiKey YOUR_KEY');
    return;
  }

  try {
    const provider = new AnthropicProvider();
    console.log(`✓ Provider created: ${provider.name}`);
    console.log(`✓ Model: ${provider.model}`);
    console.log(`✓ Supports images: ${provider.supportsImages}`);
    console.log(`✓ Token limit: ${provider.tokenLimit}`);

    // Initialize provider
    await provider.init({
      apiKey,
      model: 'claude-3-5-sonnet-20241022'
    });
    console.log('✓ Provider initialized');

    // Test streaming
    console.log('✓ Testing streaming...');
    let chunks = 0;
    for await (const chunk of provider.sendMessage('Say hello in exactly 3 words.')) {
      process.stdout.write(chunk);
      chunks++;
    }
    console.log(`\n✓ Received ${chunks} chunks`);

    // Check usage stats
    const stats = provider.getUsageStats();
    console.log(`✓ Stats: ${stats.totalRequests} requests, $${stats.totalCostUSD.toFixed(4)} cost`);

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testAnthropicProvider().catch(console.error);
}
