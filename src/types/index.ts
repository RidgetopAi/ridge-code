export interface CommandConfig {
  name: string;
  description: string;
  aliases?: string[];
  options?: CommandOption[];
}

export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: string | boolean;
  required?: boolean;
}

export interface AidisResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: string;
}

export interface CliConfig {
  aidisEndpoint: string;
  defaultProject?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  timeout: number;
}

export interface ParsedCommand {
  command: string;
  args: string[];
  options: Record<string, unknown>;
}

// Model Types
export interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageResponseTime: number;
  rateLimitHits: number;
}

export interface ModelError extends Error {
  code?: string;
  status?: number;
  retryable: boolean;
  rateLimited: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

// Response Buffer Types
export interface ResponseMetadata {
  model: string;
  tokenCount: number;
  responseTime: number;
}

export interface BufferedResponse {
  content: string;
  timestamp: Date;
  metadata: ResponseMetadata;
}

export interface AidisCommand {
  pattern: string;
  content: string;
  timestamp: Date;
  metadata: ResponseMetadata;
}

// New types for AIDIS Response Parser
export interface ParsedAidisCommand {
  command: string;
  payload: Record<string, unknown>;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: string;
}

// Command Router Types
export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  timestamp: string;
  commandType: 'aidis' | 'shell' | 'help';
}
