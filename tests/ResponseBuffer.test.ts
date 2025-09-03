import { ResponseBuffer } from '../src/response/ResponseBuffer';
import { ResponseMetadata, BufferedResponse, AidisCommand } from '../src/types';

describe('ResponseBuffer', () => {
  let buffer: ResponseBuffer;

  beforeEach(() => {
    buffer = new ResponseBuffer();
  });

  afterEach(() => {
    buffer.clear();
  });

  describe('constructor', () => {
    it('should initialize with empty buffer', () => {
      expect(buffer.size).toBe(0);
    });

    it('should have correct maximum size', () => {
      expect(ResponseBuffer.maxSize).toBe(50);
    });
  });

  describe('addResponse', () => {
    it('should add a single response correctly', () => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 150,
        responseTime: 1200,
      };

      buffer.addResponse('Test response content', metadata);

      expect(buffer.size).toBe(1);
      const responses = buffer.getRecentResponses(1);
      expect(responses).toHaveLength(1);
      expect(responses[0]?.content).toBe('Test response content');
      expect(responses[0]?.metadata).toEqual(metadata);
      expect(responses[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('should maintain circular buffer with max 50 responses', () => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 100,
        responseTime: 1000,
      };

      // Add 55 responses (5 more than max)
      for (let i = 1; i <= 55; i++) {
        buffer.addResponse(`Response ${i}`, metadata);
      }

      expect(buffer.size).toBe(50);
      
      // Check that oldest responses were removed
      const allResponses = buffer.getRecentResponses(50);
      expect(allResponses[0]?.content).toBe('Response 6'); // First response should be #6
      expect(allResponses[49]?.content).toBe('Response 55'); // Last should be #55
    });

    it('should handle metadata cloning to prevent external mutations', () => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 150,
        responseTime: 1200,
      };

      buffer.addResponse('Test content', metadata);

      // Mutate original metadata
      metadata.tokenCount = 999;

      const responses = buffer.getRecentResponses(1);
      expect(responses[0]?.metadata.tokenCount).toBe(150); // Should be unchanged
    });
  });

  describe('getRecentResponses', () => {
    beforeEach(() => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 100,
        responseTime: 1000,
      };

      // Add 10 responses
      for (let i = 1; i <= 10; i++) {
        buffer.addResponse(`Response ${i}`, metadata);
      }
    });

    it('should return correct number of recent responses', () => {
      const responses = buffer.getRecentResponses(5);
      expect(responses).toHaveLength(5);
      
      // Should return the most recent ones
      expect(responses[0]?.content).toBe('Response 6');
      expect(responses[4]?.content).toBe('Response 10');
    });

    it('should return all responses when count exceeds buffer size', () => {
      const responses = buffer.getRecentResponses(20);
      expect(responses).toHaveLength(10); // Only 10 responses in buffer
    });

    it('should return empty array when count is 0', () => {
      const responses = buffer.getRecentResponses(0);
      expect(responses).toHaveLength(0);
    });

    it('should handle negative count gracefully', () => {
      const responses = buffer.getRecentResponses(-5);
      expect(responses).toHaveLength(0);
    });

    it('should return cloned responses to prevent external mutations', () => {
      const responses = buffer.getRecentResponses(1);
      if (responses[0]) {
        responses[0].content = 'Modified content';
      }
      
      const freshResponses = buffer.getRecentResponses(1);
      expect(freshResponses[0]?.content).not.toBe('Modified content');
    });
  });

  describe('findAidisCommands', () => {
    beforeEach(() => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 200,
        responseTime: 1500,
      };

      // Add responses with various AIDIS command patterns
      buffer.addResponse('Use aidis_help to get started with AIDIS system', metadata);
      buffer.addResponse('Run project_list to see all projects', metadata);
      buffer.addResponse('Execute context_search("authentication") for relevant contexts', metadata);
      buffer.addResponse('Normal response without commands', metadata);
      buffer.addResponse('Multiple commands: aidis_ping and aidis_status work well', metadata);
    });

    it('should find simple AIDIS command patterns', () => {
      const commands = buffer.findAidisCommands('aidis_\\w+');
      
      expect(commands.length).toBeGreaterThan(0);
      const commandTexts = commands.map(cmd => cmd.pattern);
      expect(commandTexts).toContain('aidis_help');
      expect(commandTexts).toContain('aidis_ping');
      expect(commandTexts).toContain('aidis_status');
    });

    it('should find project command patterns', () => {
      const commands = buffer.findAidisCommands('project_\\w+');
      
      expect(commands).toHaveLength(1);
      expect(commands[0]?.pattern).toBe('project_list');
    });

    it('should find function call patterns', () => {
      const commands = buffer.findAidisCommands('\\w+_\\w+\\([^)]*\\)');
      
      expect(commands.length).toBeGreaterThanOrEqual(1);
      const foundCommand = commands.find(cmd => cmd.pattern.includes('context_search'));
      expect(foundCommand).toBeDefined();
      expect(foundCommand?.pattern).toBe('context_search("authentication")');
    });

    it('should return empty array when no patterns match', () => {
      const commands = buffer.findAidisCommands('nonexistent_pattern');
      expect(commands).toHaveLength(0);
    });

    it('should sort results by timestamp (most recent first)', () => {
      const commands = buffer.findAidisCommands('aidis_\\w+');
      
      if (commands.length > 1) {
        for (let i = 1; i < commands.length; i++) {
          expect(commands[i - 1]?.timestamp.getTime()).toBeGreaterThanOrEqual(
            commands[i]?.timestamp.getTime() || 0
          );
        }
      }
    });

    it('should include context around matches', () => {
      const commands = buffer.findAidisCommands('aidis_help');
      
      expect(commands).toHaveLength(1);
      expect(commands[0]?.content).toContain('aidis_help');
      expect(commands[0]?.content).toContain('get started'); // Context around the match
    });

    it('should handle case-insensitive matching', () => {
      buffer.addResponse('Use AIDIS_HELP for assistance', {
        model: 'test',
        tokenCount: 50,
        responseTime: 500,
      });

      const commands = buffer.findAidisCommands('aidis_help');
      const upperCaseMatch = commands.find(cmd => cmd.pattern === 'AIDIS_HELP');
      expect(upperCaseMatch).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should remove all responses from buffer', () => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 100,
        responseTime: 1000,
      };

      // Add some responses
      for (let i = 1; i <= 5; i++) {
        buffer.addResponse(`Response ${i}`, metadata);
      }

      expect(buffer.size).toBe(5);
      
      buffer.clear();
      
      expect(buffer.size).toBe(0);
      expect(buffer.getRecentResponses(10)).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty buffer', () => {
      const stats = buffer.getStats();
      
      expect(stats.totalResponses).toBe(0);
      expect(stats.oldestTimestamp).toBeUndefined();
      expect(stats.newestTimestamp).toBeUndefined();
      expect(stats.totalContentLength).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
    });

    it('should return correct stats for populated buffer', () => {
      const metadata1: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 100,
        responseTime: 1000,
      };
      
      const metadata2: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 150,
        responseTime: 1500,
      };

      buffer.addResponse('Short response', metadata1);
      buffer.addResponse('This is a longer response with more content', metadata2);

      const stats = buffer.getStats();
      
      expect(stats.totalResponses).toBe(2);
      expect(stats.oldestTimestamp).toBeInstanceOf(Date);
      expect(stats.newestTimestamp).toBeInstanceOf(Date);
      expect(stats.totalContentLength).toBe(
        'Short response'.length + 'This is a longer response with more content'.length
      );
      expect(stats.averageResponseTime).toBe(1250); // (1000 + 1500) / 2
    });
  });

  describe('thread safety', () => {
    it('should handle concurrent operations without data corruption', async () => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 100,
        responseTime: 1000,
      };

      // Simulate concurrent operations
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          Promise.resolve().then(() => {
            buffer.addResponse(`Concurrent response ${i}`, metadata);
          })
        );
      }

      await Promise.all(operations);

      expect(buffer.size).toBe(10);
      const responses = buffer.getRecentResponses(10);
      expect(responses).toHaveLength(10);
    });
  });

  describe('memory management', () => {
    it('should maintain bounded memory usage', () => {
      const metadata: ResponseMetadata = {
        model: 'claude-3-5-sonnet-20241022',
        tokenCount: 100,
        responseTime: 1000,
      };

      // Add more responses than the maximum
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 1; i <= 100; i++) {
        buffer.addResponse(`Response ${i} with some content to test memory usage`, metadata);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      
      // Buffer should not grow beyond max size
      expect(buffer.size).toBe(50);
      
      // Memory shouldn't grow excessively (this is a rough check)
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });
  });
});
