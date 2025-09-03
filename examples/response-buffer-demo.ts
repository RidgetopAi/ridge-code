import { ResponseBuffer } from '../src/response';
import { ResponseMetadata } from '../src/types';

/**
 * Demonstration of ResponseBuffer usage and integration patterns
 */
async function demonstrateResponseBuffer() {
  const buffer = new ResponseBuffer();
  
  // Simulate adding responses from an LLM
  const sampleResponses = [
    {
      content: 'To list all AIDIS projects, use the aidis_help command to get started.',
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 125,
        responseTime: 1200
      }
    },
    {
      content: 'You can run project_list to see all available projects in your workspace.',
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 98,
        responseTime: 950
      }
    },
    {
      content: 'For searching contexts, try context_search("your query") to find relevant information.',
      metadata: {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 142,
        responseTime: 1350
      }
    }
  ];

  // Add responses to buffer
  sampleResponses.forEach(response => {
    buffer.addResponse(response.content, response.metadata);
  });

  console.log('=== Response Buffer Demo ===');
  console.log(`Buffer size: ${buffer.size}/${ResponseBuffer.maxSize}`);
  console.log();

  // Get recent responses
  console.log('--- Recent Responses (2) ---');
  const recentResponses = buffer.getRecentResponses(2);
  recentResponses.forEach((response, index) => {
    console.log(`${index + 1}. ${response.content.substring(0, 60)}...`);
    console.log(`   Model: ${response.metadata.model}`);
    console.log(`   Tokens: ${response.metadata.tokenCount}`);
    console.log(`   Response Time: ${response.metadata.responseTime}ms`);
    console.log();
  });

  // Find AIDIS commands
  console.log('--- AIDIS Commands Found ---');
  const aidisCommands = buffer.findAidisCommands('\\w+_\\w+');
  aidisCommands.forEach((command, index) => {
    console.log(`${index + 1}. Pattern: ${command.pattern}`);
    console.log(`   Context: ${command.content.substring(0, 80)}...`);
    console.log();
  });

  // Buffer statistics
  console.log('--- Buffer Statistics ---');
  const stats = buffer.getStats();
  console.log(`Total responses: ${stats.totalResponses}`);
  console.log(`Total content length: ${stats.totalContentLength} chars`);
  console.log(`Average response time: ${stats.averageResponseTime}ms`);
  console.log(`Oldest: ${stats.oldestTimestamp?.toISOString()}`);
  console.log(`Newest: ${stats.newestTimestamp?.toISOString()}`);
}

// Integration example with AnthropicClient pattern
export class ResponseBufferIntegration {
  private buffer = new ResponseBuffer();

  /**
   * Example of how to integrate with streaming responses from AnthropicClient
   */
  async processStreamingResponse(
    chunks: AsyncIterable<string>,
    metadata: ResponseMetadata
  ): Promise<string> {
    const responseChunks: string[] = [];
    
    // Collect streaming chunks
    for await (const chunk of chunks) {
      responseChunks.push(chunk);
    }
    
    const completeResponse = responseChunks.join('');
    
    // Add to buffer for later analysis
    this.buffer.addResponse(completeResponse, metadata);
    
    return completeResponse;
  }

  /**
   * Get recent AIDIS commands for CLI processing
   */
  getRecentAidisCommands(pattern: string = '\\w+_\\w+'): string[] {
    return this.buffer.findAidisCommands(pattern).map(cmd => cmd.pattern);
  }

  /**
   * Get buffer for CLI commands like "ridge-code history"
   */
  getHistory(count: number) {
    return this.buffer.getRecentResponses(count);
  }

  /**
   * Get stats for CLI commands like "ridge-code buffer stats"
   */
  getBufferStats() {
    return this.buffer.getStats();
  }
}

// Run demo if called directly
if (require.main === module) {
  demonstrateResponseBuffer().catch(console.error);
}
