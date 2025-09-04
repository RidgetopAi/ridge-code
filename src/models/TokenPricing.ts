export const PRICE: Record<string, { in: number; out: number }> = {
  // USD per 1K tokens
  'gpt-4o': { in: 0.005, out: 0.015 },
  'gpt-4-turbo': { in: 0.01, out: 0.03 },
  'claude-3-sonnet': { in: 0.003, out: 0.015 },
  'grok-1': { in: 0.006, out: 0.018 },
};
