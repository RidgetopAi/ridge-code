import { ResponseMetadata, BufferedResponse, AidisCommand, ParsedAidisCommand } from '../types';
import { AidisResponseParser } from '../aidis/AidisResponseParser';

/**
 * ResponseBuffer manages a circular buffer of LLM responses with thread-safe operations.
 * Stores the most recent 50 responses with metadata and provides AIDIS command extraction.
 */
export class ResponseBuffer {
  private static readonly MAX_RESPONSES = 50;
  private readonly responses: BufferedResponse[] = [];
  private readonly mutex = new Set<string>(); // Simple mutex using Set for thread safety
  private readonly parser = new AidisResponseParser();

  /**
   * Add a response to the buffer with automatic circular buffer management
   */
  addResponse(content: string, metadata?: ResponseMetadata): void {
    const operationId = this.acquireLock();
    
    try {
      const defaultMetadata: ResponseMetadata = {
        model: 'unknown',
        tokenCount: 0,
        responseTime: 0
      };
      
      const response: BufferedResponse = {
        content,
        timestamp: new Date(),
        metadata: metadata ? { ...metadata } : defaultMetadata, // Default metadata if not provided
      };

      // Add to buffer
      this.responses.push(response);

      // Maintain circular buffer - remove oldest if exceeding limit
      if (this.responses.length > ResponseBuffer.MAX_RESPONSES) {
        this.responses.shift(); // Remove the oldest response
      }
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Get the most recent responses up to the specified count
   */
  getRecentResponses(count: number): BufferedResponse[] {
    const operationId = this.acquireLock();
    
    try {
      // Handle zero or negative count
      if (count <= 0) {
        return [];
      }
      
      const requestedCount = Math.min(count, this.responses.length);
      
      // Return the most recent responses (slice from end)
      return this.responses
        .slice(-requestedCount)
        .map(response => ({
          ...response,
          metadata: { ...response.metadata }, // Clone to prevent external mutations
        }));
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Find AIDIS command patterns in buffered responses
   */
  findAidisCommands(pattern: string): AidisCommand[] {
    const operationId = this.acquireLock();
    
    try {
      const commands: AidisCommand[] = [];
      const regex = new RegExp(pattern, 'gi');

      for (const response of this.responses) {
        const matches = response.content.match(regex);
        
        if (matches) {
          for (const match of matches) {
            commands.push({
              pattern: match,
              content: this.extractContextAroundMatch(response.content, match),
              timestamp: response.timestamp,
              metadata: { ...response.metadata },
            });
          }
        }
      }

      // Sort by timestamp (most recent first)
      return commands.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Extract parsed AIDIS commands from buffered responses using the response parser
   */
  extractParsedAidisCommands(): ParsedAidisCommand[] {
    const operationId = this.acquireLock();
    
    try {
      const allCommands: ParsedAidisCommand[] = [];

      for (const response of this.responses) {
        const commands = this.parser.extractCommands(response.content);
        allCommands.push(...commands);
      }

      return allCommands;
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Get the most recent AIDIS commands with parsed payloads
   */
  getRecentAidisCommands(count: number = 10): ParsedAidisCommand[] {
    const allCommands = this.extractParsedAidisCommands();
    return allCommands.slice(0, Math.min(count, allCommands.length));
  }

  /**
   * Clear all buffered responses
   */
  clear(): void {
    const operationId = this.acquireLock();
    
    try {
      this.responses.length = 0;
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Get buffer statistics (useful for monitoring)
   */
  getStats(): {
    totalResponses: number;
    oldestTimestamp?: Date;
    newestTimestamp?: Date;
    totalContentLength: number;
    averageResponseTime: number;
  } {
    const operationId = this.acquireLock();
    
    try {
      const totalResponses = this.responses.length;
      
      if (totalResponses === 0) {
        return {
          totalResponses: 0,
          totalContentLength: 0,
          averageResponseTime: 0,
        };
      }

      const oldestTimestamp = this.responses[0]?.timestamp;
      const newestTimestamp = this.responses[totalResponses - 1]?.timestamp;
      
      const totalContentLength = this.responses.reduce((sum, response) => {
        return sum + response.content.length;
      }, 0);

      const averageResponseTime = this.responses.reduce((sum, response) => {
        return sum + response.metadata.responseTime;
      }, 0) / totalResponses;

      return {
        totalResponses,
        oldestTimestamp,
        newestTimestamp,
        totalContentLength,
        averageResponseTime,
      };
    } finally {
      this.releaseLock(operationId);
    }
  }

  /**
   * Extract context around a matched pattern for better command understanding
   */
  private extractContextAroundMatch(content: string, match: string): string {
    const matchIndex = content.indexOf(match);
    if (matchIndex === -1) return match;

    const contextRadius = 100; // Characters before and after the match
    const start = Math.max(0, matchIndex - contextRadius);
    const end = Math.min(content.length, matchIndex + match.length + contextRadius);

    let context = content.substring(start, end);
    
    // Add ellipsis if we're not at the beginning/end
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';

    return context;
  }

  /**
   * Simple thread-safety mechanism using operation IDs
   */
  private acquireLock(): string {
    const operationId = `${Date.now()}-${Math.random()}`;
    
    // Simple spin-wait for concurrent access (suitable for Node.js single-threaded nature)
    while (this.mutex.size > 0) {
      // In Node.js, this provides basic protection against race conditions
      // in case of asynchronous operations
    }
    
    this.mutex.add(operationId);
    return operationId;
  }

  /**
   * Release the lock for the given operation
   */
  private releaseLock(operationId: string): void {
    this.mutex.delete(operationId);
  }

  /**
   * Get the current buffer size
   */
  get size(): number {
    return this.responses.length;
  }

  /**
   * Get the maximum buffer capacity
   */
  static get maxSize(): number {
    return ResponseBuffer.MAX_RESPONSES;
  }
}
