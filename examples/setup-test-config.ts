#!/usr/bin/env npx ts-node

import { ConfigManager } from '../src/core/ConfigManager';

/**
 * Setup test configuration for AnthropicClient
 * This script helps initialize configuration for testing
 */

async function setupTestConfig() {
  console.log('🔧 Setting up test configuration...\n');
  
  const configManager = ConfigManager.getInstance();
  
  try {
    // Check if config file exists
    const exists = await configManager.exists();
    
    if (!exists) {
      console.log('📝 Creating new configuration file...');
      await configManager.init();
      console.log('✅ Configuration file created\n');
    } else {
      console.log('✅ Configuration file already exists\n');
    }
    
    // Show current Anthropic configuration
    console.log('📋 Current Anthropic Configuration:');
    
    try {
      const apiKey = await configManager.get('models.anthropic.apiKey');
      const model = await configManager.get('models.anthropic.model');
      
      console.log(`   API Key: ${apiKey ? '***configured***' : 'NOT SET'}`);
      console.log(`   Model: ${model}`);
      
      if (!apiKey) {
        console.log('\n⚠️  API Key not configured!');
        console.log('   Set it with: RIDGE_CODE_ANTHROPIC_KEY=your_key_here');
        console.log('   Or run: ridge-code config set models.anthropic.apiKey YOUR_KEY');
      } else {
        console.log('\n✅ Configuration looks good for testing!');
      }
      
    } catch (error) {
      console.log('❌ Error reading configuration:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    console.log();
    
  } catch (error) {
    console.error('❌ Setup failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setupTestConfig();
}

export { setupTestConfig };
