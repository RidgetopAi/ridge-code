import Anthropic from '@anthropic-ai/sdk';
import { ConfigManager } from '../core/ConfigManager';
import { ConversationContext, ModelUsageStats, ModelError, RetryConfig } from '../types';

/**
 * AnthropicClient provides streaming and complete message support
 * with built-in retry logic, usage tracking, and configuration integration
 */
export class AnthropicClient {
  private client: Anthropic;
  private configManager: ConfigManager;
  private usageStats: ModelUsageStats;
  private retryConfig: RetryConfig;

  // Current Anthropic pricing (as of latest update)
  private readonly PRICING = {
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 }, // per 1K tokens
    'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  } as const;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.usageStats = this.initializeStats();
    this.retryConfig = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      exponentialBase: 2,
    };

    // Initialize client - will be configured in init()
    this.client = new Anthropic({ apiKey: '' });
  }

  /**
   * Initialize the client with configuration
   */
  async init(): Promise<void> {
    try {
      const apiKey = await this.configManager.get('models.anthropic.apiKey');
      if (!apiKey) {
        throw new Error(
          'Anthropic API key not configured. Run "ridge-code config set models.anthropic.apiKey YOUR_KEY"'
        );
      }

      this.client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: false, // We're in Node.js
      });
    } catch (error) {
      throw createModelError(
        `Failed to initialize Anthropic client: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { retryable: false, rateLimited: false }
      );
    }
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessage(message: string, context?: ConversationContext): AsyncIterable<string> {
    const startTime = Date.now();
    this.usageStats.totalRequests++;

    try {
      const model =
        (await this.configManager.get('models.anthropic.model')) || 'claude-3-5-sonnet-20241022';

      // Build messages array
      const messages = this.buildMessages(message, context);

      // Get system prompt
      const systemPrompt = context?.systemPrompt;

      const response = await this.withRetry(async () => {
        return this.client.messages.stream({
          model,
          messages,
          max_tokens: context?.maxTokens || 4096,
          temperature: context?.temperature || 0.7,
          ...(systemPrompt && { system: systemPrompt }),
        });
      });

      let totalOutputTokens = 0;

      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = (chunk.delta as any).text;
          totalOutputTokens += this.estimateTokens(text);
          yield text;
        } else if (chunk.type === 'message_start' && chunk.message.usage) {
          this.usageStats.totalInputTokens += chunk.message.usage.input_tokens;
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          this.usageStats.totalOutputTokens += chunk.usage.output_tokens;
          totalOutputTokens = chunk.usage.output_tokens; // Get accurate count
        }
      }

      // Update usage statistics
      this.updateUsageStats(startTime, totalOutputTokens, model);
      this.usageStats.successfulRequests++;
    } catch (error) {
      this.usageStats.failedRequests++;
      this.updateResponseTime(startTime);
      throw this.handleError(error);
    }
  }

  /**
   * Send a message and return complete response
   */
  async sendMessageComplete(message: string, context?: ConversationContext): Promise<string> {
    const chunks: string[] = [];

    for await (const chunk of this.sendMessage(message, context)) {
      chunks.push(chunk);
    }

    return chunks.join('');
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): ModelUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats = this.initializeStats();
  }

  /**
   * Build messages array for Anthropic API
   */
  private buildMessages(
    newMessage: string,
    context?: ConversationContext
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add context messages (excluding system messages)
    if (context?.messages) {
      for (const msg of context.messages) {
        if (msg.role !== 'system') {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }
    }

    // Add the new message
    messages.push({
      role: 'user',
      content: newMessage,
    });

    return messages;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error = new Error('Unknown retry error');

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const modelError = this.handleError(error);
        if (!modelError.retryable) {
          throw modelError;
        }

        // Check if we've exceeded max retries
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.exponentialBase, attempt),
          this.retryConfig.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }

    throw lastError;
  }

  /**
   * Handle and classify errors
   */
  private handleError(error: unknown): ModelError {
    if (error instanceof Anthropic.APIError) {
      const isRateLimit = error.status === 429;
      const isRetryable =
        isRateLimit ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504;

      if (isRateLimit) {
        this.usageStats.rateLimitHits++;
      }

      const modelError = createModelError(
        `Anthropic API Error (${error.status}): ${error.message}`,
        { retryable: isRetryable, rateLimited: isRateLimit }
      );

      modelError.status = error.status;
      return modelError;
    }

    if (error instanceof Error) {
      return createModelError(error.message, { retryable: true, rateLimited: false });
    }

    return createModelError('Unknown error occurred', { retryable: false, rateLimited: false });
  }

  /**
   * Initialize usage statistics
   */
  private initializeStats(): ModelUsageStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
    };
  }

  /**
   * Update usage statistics after successful request
   */
  private updateUsageStats(startTime: number, outputTokens: number, model: string): void {
    const responseTime = Date.now() - startTime;

    // Update average response time
    const totalRequests = this.usageStats.successfulRequests + this.usageStats.failedRequests;
    this.usageStats.averageResponseTime =
      (this.usageStats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Update cost estimation
    this.updateCostEstimate(outputTokens, model);
  }

  /**
   * Update response time for failed requests
   */
  private updateResponseTime(startTime: number): void {
    const responseTime = Date.now() - startTime;
    const totalRequests = this.usageStats.successfulRequests + this.usageStats.failedRequests;
    this.usageStats.averageResponseTime =
      (this.usageStats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Update cost estimation based on token usage
   */
  private updateCostEstimate(outputTokens: number, model: string): void {
    const pricing = this.PRICING[model as keyof typeof this.PRICING];
    if (!pricing) return;

    // Estimate input tokens based on recent requests
    const estimatedInputTokens = Math.round(outputTokens * 0.7); // Rough estimate

    const inputCost = (estimatedInputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;

    this.usageStats.totalCost += inputCost + outputCost;
  }

  /**
   * Rough token estimation for streaming chunks
   * This is a simple approximation - actual tokens may differ
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create ModelError with proper prototype chain
 */
function createModelError(
  message: string,
  options: { retryable: boolean; rateLimited: boolean }
): ModelError {
  const error = new Error(message) as ModelError;
  error.retryable = options.retryable;
  error.rateLimited = options.rateLimited;
  return error;
}
