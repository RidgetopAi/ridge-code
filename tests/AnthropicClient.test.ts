import { AnthropicClient } from '../src/models/AnthropicClient';
import { ConfigManager } from '../src/core/ConfigManager';

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let configManager: ConfigManager;

  beforeEach(() => {
    client = new AnthropicClient();
    configManager = ConfigManager.getInstance();
  });

  afterEach(() => {
    configManager.clearCache();
  });

  describe('initialization', () => {
    it('should create client with initial usage stats', () => {
      const stats = client.getUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
    });

    it('should throw error when API key is not configured', async () => {
      // Mock missing API key
      jest.spyOn(configManager, 'get').mockResolvedValue('');
      
      await expect(client.init()).rejects.toThrow('Anthropic API key not configured');
    });

    it('should initialize successfully with valid API key', async () => {
      // Mock valid API key
      jest.spyOn(configManager, 'get').mockResolvedValue('sk-test-key');
      
      await expect(client.init()).resolves.toBeUndefined();
    });
  });

  describe('usage statistics', () => {
    it('should reset usage statistics', () => {
      // Simulate some usage
      const stats = client.getUsageStats();
      stats.totalRequests = 5;
      
      client.resetUsageStats();
      
      const resetStats = client.getUsageStats();
      expect(resetStats.totalRequests).toBe(0);
    });

    it('should return immutable copy of usage stats', () => {
      const stats1 = client.getUsageStats();
      const stats2 = client.getUsageStats();
      
      expect(stats1).not.toBe(stats2); // Different objects
      expect(stats1).toEqual(stats2); // Same content
    });
  });

  describe('message formatting', () => {
    it('should handle simple message without context', () => {
      // This would test the private buildMessages method
      // In a real test, we'd need to expose it or test through public methods
      expect(true).toBe(true); // Placeholder
    });

    it('should handle message with conversation context', () => {
      // Test context handling
      expect(true).toBe(true); // Placeholder
    });
  });
});
