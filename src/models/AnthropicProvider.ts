import Anthropic from '@anthropic-ai/sdk';
import { ModelProvider, ProviderConfig, ConversationContext, UsageStats } from './ModelProvider';
import { PRICE } from './TokenPricing';
import { ModelError } from '../types';

/**
 * AnthropicProvider implements the ModelProvider interface for Claude models
 * Provides streaming chat completions with usage tracking and retry logic
 */
export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  readonly supportsImages = true;
  readonly tokenLimit = 200000; // Claude 3.5 Sonnet limit

  private client!: Anthropic;
  private _model: string = 'claude-3-5-sonnet-20241022';
  private usageStats: UsageStats;
  private retryConfig = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
  };

  constructor() {
    this.usageStats = this.initializeStats();
  }

  get model(): string {
    return this._model;
  }

  /**
   * Initialize the provider with configuration
   */
  async init(cfg: ProviderConfig): Promise<void> {
    try {
      if (!cfg.apiKey) {
        throw new Error('Anthropic API key is required');
      }

      this.client = new Anthropic({
        apiKey: cfg.apiKey,
        baseURL: cfg.baseUrl,
        dangerouslyAllowBrowser: false,
      });

      this._model = cfg.model || 'claude-3-5-sonnet-20241022';
    } catch (error) {
      throw this.createModelError(
        `Failed to initialize Anthropic provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { retryable: false, rateLimited: false }
      );
    }
  }

  /**
   * Send a message with streaming response
   */
  async *sendMessage(message: string, ctx?: ConversationContext): AsyncIterable<string> {
    if (!this.client) {
      throw new Error('Provider not initialized. Call init() first.');
    }

    const startTime = Date.now();
    this.usageStats.totalRequests++;

    try {
      // Build messages array
      const messages = this.buildMessages(message, ctx);

      // Get system prompt
      const systemPrompt = ctx?.systemPrompt;

      const response = await this.withRetry(async () => {
        return this.client.messages.stream({
          model: this._model,
          messages,
          max_tokens: ctx?.maxTokens || 4096,
          temperature: ctx?.temperature || 0.7,
          ...(systemPrompt && { system: systemPrompt }),
        });
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = (chunk.delta as any).text;
          yield text;
        } else if (chunk.type === 'message_start' && chunk.message.usage) {
          inputTokens = chunk.message.usage.input_tokens;
          this.usageStats.totalInputTokens += inputTokens;
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          outputTokens = chunk.usage.output_tokens;
          this.usageStats.totalOutputTokens += outputTokens;
        }
      }

      // Update stats after successful completion
      const latency = Date.now() - startTime;
      this.updateStats(inputTokens, outputTokens, latency);
    } catch (error) {
      const latency = Date.now() - startTime;
      this.usageStats.lastLatencyMs = latency;
      throw this.handleError(error);
    }
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  /**
   * Optional cleanup method
   */
  async close(): Promise<void> {
    // No specific cleanup needed for Anthropic client
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

      const modelError = this.createModelError(
        `Anthropic API Error (${error.status}): ${error.message}`,
        { retryable: isRetryable, rateLimited: isRateLimit }
      );

      modelError.status = error.status;
      return modelError;
    }

    if (error instanceof Error) {
      return this.createModelError(error.message, { retryable: true, rateLimited: false });
    }

    return this.createModelError('Unknown error occurred', {
      retryable: false,
      rateLimited: false,
    });
  }

  /**
   * Initialize usage statistics
   */
  private initializeStats(): UsageStats {
    return {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
    };
  }

  /**
   * Update usage statistics after successful request
   */
  private updateStats(inputTokens: number, outputTokens: number, latency: number): void {
    this.usageStats.lastLatencyMs = latency;

    // Calculate cost using TokenPricing
    const pricing = PRICE['claude-3-sonnet']; // Using the pricing key from TokenPricing
    if (pricing) {
      const inputCost = (inputTokens / 1000) * pricing.in;
      const outputCost = (outputTokens / 1000) * pricing.out;
      this.usageStats.totalCostUSD += inputCost + outputCost;
    }
  }

  /**
   * Create ModelError with proper prototype chain
   */
  private createModelError(
    message: string,
    options: { retryable: boolean; rateLimited: boolean }
  ): ModelError {
    const error = new Error(message) as ModelError;
    error.retryable = options.retryable;
    error.rateLimited = options.rateLimited;
    return error;
  }
}
