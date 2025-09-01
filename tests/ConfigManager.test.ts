import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../src/core/ConfigManager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempConfigPath: string;

  beforeEach(() => {
    configManager = ConfigManager.getInstance();
    configManager.clearCache();
    
    // Use a temporary config path for testing
    tempConfigPath = path.join(os.tmpdir(), '.ridge-code-test', 'config.json');
    
    // Mock the config path for testing
    (configManager as any).configPath = tempConfigPath;
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(path.dirname(tempConfigPath), { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should create default configuration', async () => {
      await configManager.init();
      const exists = await configManager.exists();
      expect(exists).toBe(true);
    });

    it('should create valid default configuration structure', async () => {
      await configManager.init();
      const config = await configManager.load();
      
      expect(config).toMatchObject({
        models: {
          anthropic: {
            apiKey: '',
            model: 'claude-3-5-sonnet-20241022',
          },
          openai: {
            apiKey: '',
            model: 'gpt-4',
          },
          xai: {
            apiKey: '',
            model: 'grok-beta',
          },
        },
        aidis: {
          mcpEndpoint: 'stdio://aidis-mcp',
          authMethod: 'zod-validation',
        },
        ui: {
          maxResponseBuffer: 10000,
          showThinking: false,
        },
      });
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      await configManager.init();
    });

    it('should set and get configuration values', async () => {
      await configManager.set('models.anthropic.apiKey', 'test-api-key');
      const value = await configManager.get('models.anthropic.apiKey');
      expect(value).toBe('test-api-key');
    });

    it('should handle nested property access', async () => {
      await configManager.set('ui.maxResponseBuffer', 5000);
      const value = await configManager.get('ui.maxResponseBuffer');
      expect(value).toBe(5000);
    });

    it('should handle boolean values', async () => {
      await configManager.set('ui.showThinking', true);
      const value = await configManager.get('ui.showThinking');
      expect(value).toBe(true);
    });
  });

  describe('environment variable overrides', () => {
    beforeEach(async () => {
      await configManager.init();
    });

    afterEach(() => {
      // Clean up environment variables
      delete process.env.RIDGE_CODE_ANTHROPIC_KEY;
      delete process.env.RIDGE_CODE_SHOW_THINKING;
    });

    it('should use environment variable override for API key', async () => {
      await configManager.set('models.anthropic.apiKey', 'config-key');
      process.env.RIDGE_CODE_ANTHROPIC_KEY = 'env-key';
      
      const value = await configManager.get('models.anthropic.apiKey');
      expect(value).toBe('env-key');
    });

    it('should convert boolean environment variables correctly', async () => {
      process.env.RIDGE_CODE_SHOW_THINKING = 'true';
      
      const value = await configManager.get('ui.showThinking');
      expect(value).toBe(true);
    });

    it('should convert numeric environment variables correctly', async () => {
      process.env.RIDGE_CODE_MAX_BUFFER = '15000';
      
      const value = await configManager.get('ui.maxResponseBuffer');
      expect(value).toBe(15000);
    });
  });

  describe('error handling', () => {
    it('should throw error when config file does not exist', async () => {
      await expect(configManager.load()).rejects.toThrow('Configuration file not found');
    });

    it('should validate configuration structure', async () => {
      // Create invalid config file
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });
      const invalidConfig = { invalid: 'structure' };
      const encryptedInvalid = (configManager as any).encrypt(JSON.stringify(invalidConfig));
      await fs.writeFile(tempConfigPath, JSON.stringify(encryptedInvalid));
      
      await expect(configManager.load()).rejects.toThrow('Invalid configuration');
    });

    it('should handle corrupted config file', async () => {
      await fs.mkdir(path.dirname(tempConfigPath), { recursive: true });
      await fs.writeFile(tempConfigPath, 'invalid json');
      
      await expect(configManager.load()).rejects.toThrow();
    });
  });

  describe('persistence', () => {
    it('should persist changes across instances', async () => {
      await configManager.init();
      await configManager.set('models.anthropic.apiKey', 'persistent-key');
      
      // Create new instance
      const newConfigManager = ConfigManager.getInstance();
      (newConfigManager as any).configPath = tempConfigPath;
      newConfigManager.clearCache();
      
      const value = await newConfigManager.get('models.anthropic.apiKey');
      expect(value).toBe('persistent-key');
    });
  });
});
