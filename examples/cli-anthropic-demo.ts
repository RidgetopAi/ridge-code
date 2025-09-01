#!/usr/bin/env npx ts-node

import { AnthropicClient } from '../src/models/AnthropicClient';
import { ConversationContext } from '../src/types';

/**
 * CLI Demo showing how AnthropicClient would integrate with Ridge-Code
 */

interface CLIOptions {
  stream?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  showStats?: boolean;
}

async function processMessage(message: string, options: CLIOptions = {}) {
  console.log('🤖 Ridge-Code - Anthropic Integration Demo\n');
  
  const client = new AnthropicClient();
  
  try {
    await client.init();
    console.log('✅ Connected to Anthropic API\n');
    
    // Build context if system prompt provided
    const context: ConversationContext | undefined = options.systemPrompt ? {
      messages: [],
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens || 2000,
      temperature: options.temperature || 0.7,
    } : undefined;
    
    console.log('📝 Query:', message);
    if (context) {
      console.log('⚙️ System:', context.systemPrompt);
      console.log(`   Max tokens: ${context.maxTokens}, Temperature: ${context.temperature}`);
    }
    console.log('\n🔄 Response:');
    console.log('-'.repeat(60));
    
    const startTime = Date.now();
    
    if (options.stream !== false) {
      // Default: streaming response
      for await (const chunk of client.sendMessage(message, context)) {
        process.stdout.write(chunk);
      }
    } else {
      // Complete response
      const response = await client.sendMessageComplete(message, context);
      console.log(response);
    }
    
    const duration = Date.now() - startTime;
    console.log('\n' + '-'.repeat(60));
    console.log(`⏱️  Response time: ${duration}ms`);
    
    if (options.showStats) {
      const stats = client.getUsageStats();
      console.log('\n📊 Usage Statistics:');
      console.log(`   Requests: ${stats.totalRequests} (${stats.successfulRequests} successful)`);
      console.log(`   Tokens: ${stats.totalInputTokens} input, ${stats.totalOutputTokens} output`);
      console.log(`   Cost: $${stats.totalCost.toFixed(4)}`);
      console.log(`   Avg time: ${stats.averageResponseTime}ms`);
      if (stats.rateLimitHits > 0) {
        console.log(`   Rate limits: ${stats.rateLimitHits}`);
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.rateLimited) {
      console.error('   This was a rate limiting error - the client will retry automatically');
    }
    if (error.retryable) {
      console.error('   This error is retryable');
    }
    
    process.exit(1);
  }
}

// CLI argument parsing
function parseArgs(): { message: string; options: CLIOptions } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx ts-node cli-anthropic-demo.ts "Your message" [options]');
    console.log('Options:');
    console.log('  --no-stream          Use complete response instead of streaming');
    console.log('  --system "prompt"    Set system prompt');
    console.log('  --temperature 0.7    Set temperature (0-1)');
    console.log('  --max-tokens 2000    Set max tokens');
    console.log('  --show-stats         Show usage statistics');
    console.log('\nExamples:');
    console.log('  npx ts-node cli-anthropic-demo.ts "Explain TypeScript"');
    console.log('  npx ts-node cli-anthropic-demo.ts "Write a function" --system "You are a code assistant"');
    console.log('  npx ts-node cli-anthropic-demo.ts "Short answer" --temperature 0.1 --show-stats');
    process.exit(0);
  }
  
  const message = args[0];
  const options: CLIOptions = {};
  
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--no-stream':
        options.stream = false;
        break;
      case '--system':
        options.systemPrompt = args[++i];
        break;
      case '--temperature':
        options.temperature = parseFloat(args[++i]);
        break;
      case '--max-tokens':
        options.maxTokens = parseInt(args[++i], 10);
        break;
      case '--show-stats':
        options.showStats = true;
        break;
    }
  }
  
  return { message, options };
}

// Demo scenarios
async function runDemo() {
  console.log('🎯 Ridge-Code Anthropic Integration Demos\n');
  
  const demos = [
    {
      name: 'Basic Question',
      message: 'What is TypeScript?',
      options: { showStats: true }
    },
    {
      name: 'Code Assistant',
      message: 'Write a TypeScript function to validate an email address',
      options: {
        systemPrompt: 'You are a helpful coding assistant. Provide clean, well-commented code.',
        temperature: 0.3,
        maxTokens: 500,
        showStats: true
      }
    },
    {
      name: 'Quick Answer (No Streaming)',
      message: 'What is the capital of Japan?',
      options: {
        stream: false,
        temperature: 0.1,
        maxTokens: 50,
        showStats: true
      }
    }
  ];
  
  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Demo ${i + 1}: ${demo.name}`);
    console.log('='.repeat(80));
    
    try {
      await processMessage(demo.message, demo.options);
      console.log('\n✅ Demo completed successfully');
    } catch (error) {
      console.error('\n❌ Demo failed:', error);
    }
    
    if (i < demos.length - 1) {
      console.log('\nPress Enter to continue to next demo...');
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve(null));
      });
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('🎉 All demos completed!');
  console.log('='.repeat(80));
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--demo')) {
    runDemo().catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
  } else {
    try {
      const { message, options } = parseArgs();
      processMessage(message, options);
    } catch (error) {
      console.error('CLI failed:', error);
      process.exit(1);
    }
  }
}

export { processMessage };
