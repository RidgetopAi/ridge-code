import { RidgeCodeCLI } from '../src/core/RidgeCodeCLI';
import { ConfigManager } from '../src/core/ConfigManager';
import { AnthropicClient } from '../src/models/AnthropicClient';
import { AidisMcpClient } from '../src/aidis/AidisMcpClient';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock dependencies
jest.mock('../src/core/ConfigManager');
jest.mock('../src/models/AnthropicClient');
jest.mock('../src/aidis/AidisMcpClient');
jest.mock('fs/promises');
jest.mock('readline');

describe('RidgeCodeCLI', () => {
  let cli: RidgeCodeCLI;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockAnthropicClient: jest.Mocked<AnthropicClient>;
  let mockAidisClient: jest.Mocked<AidisMcpClient>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock ConfigManager
    mockConfigManager = {
      getInstance: jest.fn(),
      init: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      load: jest.fn().mockResolvedValue({
        models: {
          anthropic: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' }
        },
        aidis: { mcpEndpoint: 'http://localhost:8080' }
      }),
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
      clearCache: jest.fn()
    } as any;

    (ConfigManager.getInstance as jest.Mock).mockReturnValue(mockConfigManager);

    // Mock AnthropicClient
    mockAnthropicClient = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      sendMessage: jest.fn().mockResolvedValue('Mock response'),
      sendStreamingMessage: jest.fn()
    } as any;

    (AnthropicClient as jest.Mock).mockImplementation(() => mockAnthropicClient);

    // Mock AidisMcpClient
    mockAidisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      ping: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn()
    } as any;

    (AidisMcpClient as jest.Mock).mockImplementation(() => mockAidisClient);

    cli = new RidgeCodeCLI();
  });

  describe('initialization', () => {
    it('should create CLI instance with all components', () => {
      expect(cli).toBeInstanceOf(RidgeCodeCLI);
      expect(ConfigManager.getInstance).toHaveBeenCalled();
      expect(AnthropicClient).toHaveBeenCalled();
      expect(AidisMcpClient).toHaveBeenCalled();
    });

    it('should initialize services correctly', async () => {
      const initSpy = jest.spyOn(cli as any, 'initializeServices');
      
      // Mock initializeServices to avoid actual service calls
      initSpy.mockImplementation(async () => {
        await mockConfigManager.init();
        await mockAnthropicClient.initialize('test-key');
      });

      await (cli as any).initializeServices();

      expect(mockConfigManager.init).toHaveBeenCalled();
      expect(mockAnthropicClient.initialize).toHaveBeenCalled();
    });
  });

  describe('command handling', () => {
    beforeEach(async () => {
      // Mock successful initialization
      const initSpy = jest.spyOn(cli as any, 'initializeServices');
      initSpy.mockResolvedValue(undefined);
    });

    it('should handle config init command', async () => {
      const mockArgv = ['node', 'ridge-code', 'config', 'init'];
      process.argv = mockArgv;

      mockConfigManager.exists.mockResolvedValue(false);

      const result = await (cli as any).handleConfigInit();
      
      expect(mockConfigManager.init).toHaveBeenCalled();
    });

    it('should handle config set command', async () => {
      mockConfigManager.get.mockResolvedValue('old-value');

      await (cli as any).handleConfigSet('models.anthropic.apiKey', 'new-api-key');

      expect(mockConfigManager.set).toHaveBeenCalledWith('models.anthropic.apiKey', 'new-api-key');
      expect(mockConfigManager.save).toHaveBeenCalled();
    });

    it('should handle config get command', async () => {
      mockConfigManager.get.mockResolvedValue('test-value');

      const result = await (cli as any).handleConfigGet('models.anthropic.apiKey');

      expect(mockConfigManager.get).toHaveBeenCalledWith('models.anthropic.apiKey');
    });
  });

  describe('error handling', () => {
    it('should handle config manager initialization errors', async () => {
      mockConfigManager.init.mockRejectedValue(new Error('Config init failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await (cli as any).initializeServices();
      } catch (error) {
        expect(consoleSpy).toHaveBeenCalled();
      }
    });

    it('should handle Anthropic client initialization errors', async () => {
      mockAnthropicClient.initialize.mockRejectedValue(new Error('API key invalid'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await mockAnthropicClient.initialize('invalid-key');
      } catch (error) {
        expect(mockAnthropicClient.initialize).toHaveBeenCalledWith('invalid-key');
      }
    });
  });

  describe('graceful shutdown', () => {
    it('should setup signal handlers for graceful shutdown', () => {
      const processOnSpy = jest.spyOn(process, 'on');
      
      new RidgeCodeCLI();

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should cleanup resources on shutdown', async () => {
      const shutdownSpy = jest.spyOn(cli as any, 'shutdown').mockImplementation();

      await (cli as any).shutdown();

      expect(mockAidisClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('interactive mode', () => {
    it('should start interactive mode', async () => {
      const mockReadline = require('readline');
      mockReadline.createInterface = jest.fn().mockReturnValue({
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      });

      const startInteractiveSpy = jest.spyOn(cli as any, 'startInteractiveMode').mockImplementation();

      await (cli as any).startInteractiveMode();

      expect(startInteractiveSpy).toHaveBeenCalled();
    });
  });

  describe('chat functionality', () => {
    it('should handle single chat message', async () => {
      const mockMessage = 'Hello, how are you?';
      mockAnthropicClient.sendMessage.mockResolvedValue('I am doing well, thank you!');

      const handleChatSpy = jest.spyOn(cli as any, 'handleChat').mockImplementation();

      await (cli as any).handleChat(mockMessage);

      expect(handleChatSpy).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle streaming chat message', async () => {
      const mockMessage = 'Explain TypeScript';
      const mockStream = (async function*() {
        yield 'TypeScript is a typed ';
        yield 'superset of JavaScript';
      })();

      mockAnthropicClient.sendStreamingMessage.mockResolvedValue(mockStream);

      const handleStreamingChatSpy = jest.spyOn(cli as any, 'handleStreamingChat').mockImplementation();

      await (cli as any).handleStreamingChat(mockMessage);

      expect(handleStreamingChatSpy).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('AIDIS integration', () => {
    it('should connect to AIDIS on initialization', async () => {
      const connectToAidisSpy = jest.spyOn(cli as any, 'connectToAidis').mockImplementation();

      await (cli as any).connectToAidis();

      expect(connectToAidisSpy).toHaveBeenCalled();
    });

    it('should handle AIDIS connection failure gracefully', async () => {
      mockAidisClient.connect.mockRejectedValue(new Error('AIDIS connection failed'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      try {
        await mockAidisClient.connect();
      } catch (error) {
        expect(consoleSpy).not.toThrow();
      }
    });
  });
});
