export interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  lastLatencyMs?: number;
}

export interface ConversationContext {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  orgId?: string;
}

export interface ModelProvider {
  readonly name: string; // "anthropic", "openai", …
  readonly model: string; // "claude-3", "gpt-4-turbo", …
  readonly supportsImages: boolean;
  readonly tokenLimit: number;

  init(cfg: ProviderConfig): Promise<void>;
  sendMessage(message: string, ctx?: ConversationContext): AsyncIterable<string>; // MUST yield raw text chunks
  getUsageStats(): UsageStats;
  close?(): Promise<void>;
}
