import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { z } from 'zod';

// Provider configuration schema
const ProviderConfigSchema = z.object({
  apiKey: z.string(),
  model: z.string(),
});

// Configuration schema with Zod validation
const RidgeCodeConfigSchema = z.object({
  models: z.record(z.string(), ProviderConfigSchema).refine(
    models => {
      // Ensure required providers exist with proper defaults
      const requiredProviders = ['anthropic', 'openai', 'xai'];
      const defaults = {
        anthropic: { model: 'claude-3-5-sonnet-20241022' },
        openai: { model: 'gpt-4' },
        xai: { model: 'grok-beta' },
      };

      for (const provider of requiredProviders) {
        if (!models[provider]) {
          models[provider] = {
            apiKey: '',
            model: defaults[provider as keyof typeof defaults].model,
          };
        }
      }
      return true;
    },
    { message: 'Missing required provider configurations' }
  ),
  aidis: z.object({
    mcpEndpoint: z.string(),
    httpBridge: z.string().optional(),
    authMethod: z.literal('zod-validation'),
  }),
  ui: z.object({
    maxResponseBuffer: z.number().default(10000),
    showThinking: z.boolean().default(false),
  }),
});

export type RidgeCodeConfig = z.infer<typeof RidgeCodeConfigSchema>;

// Individual provider configuration type
export interface ProviderConfig {
  apiKey: string;
  model: string;
}

// Encrypted storage format
interface EncryptedConfigFile {
  data: string; // encrypted config JSON
  iv: string;
  salt: string;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: RidgeCodeConfig | null = null;
  private configPath: string;
  private encryptionKey: Buffer | null = null;

  private constructor() {
    this.configPath = path.join(os.homedir(), '.ridge-code', 'config.json');
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Generate encryption key from user's system information
   * This provides basic encryption without requiring user to manage keys
   */
  private generateEncryptionKey(): Buffer {
    if (this.encryptionKey) return this.encryptionKey;

    // Use system-specific information to generate a consistent key
    const keyMaterial = `${os.hostname()}-${os.userInfo().username}-ridge-code`;
    this.encryptionKey = crypto.scryptSync(keyMaterial, 'ridge-code-salt', 32);
    return this.encryptionKey;
  }

  /**
   * Encrypt sensitive configuration data
   */
  private encrypt(data: string): EncryptedConfigFile {
    const key = this.generateEncryptionKey();
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      data: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
    };
  }

  /**
   * Decrypt sensitive configuration data
   */
  private decrypt(encryptedConfig: EncryptedConfigFile): string {
    try {
      const key = this.generateEncryptionKey();
      const iv = Buffer.from(encryptedConfig.iv, 'hex');

      const [encryptedData, authTag] = encryptedConfig.data.split(':');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      if (authTag) {
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      }

      let decrypted = decipher.update(encryptedData || '', 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(
        `Failed to decrypt configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get environment variable override for a config path
   */
  private getEnvOverride(keyPath: string): string | undefined {
    // Dynamic mapping for provider configurations
    if (keyPath.startsWith('models.')) {
      const pathParts = keyPath.split('.');
      if (pathParts.length === 3) {
        const [, provider, property] = pathParts;
        if (provider && property) {
          const providerUpper = provider.replace(/([A-Z])/g, '_$1').toUpperCase();

          if (property === 'apiKey') {
            return process.env[`RIDGE_CODE_${providerUpper}_KEY`];
          } else if (property === 'model') {
            return process.env[`RIDGE_CODE_${providerUpper}_MODEL`];
          }
        }
      }
    }

    // Static mappings for other configurations
    const staticMappings: Record<string, string> = {
      'aidis.mcpEndpoint': 'RIDGE_CODE_AIDIS_ENDPOINT',
      'aidis.httpBridge': 'RIDGE_CODE_AIDIS_BRIDGE',
      'ui.maxResponseBuffer': 'RIDGE_CODE_MAX_BUFFER',
      'ui.showThinking': 'RIDGE_CODE_SHOW_THINKING',
    };

    const envVar = staticMappings[keyPath];
    return envVar ? process.env[envVar] : undefined;
  }

  /**
   * Get nested property value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set nested property value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Ensure config directory exists
   */
  private async ensureConfigDir(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create config directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<RidgeCodeConfig> {
    try {
      const fileContent = await fs.readFile(this.configPath, 'utf8');
      const encryptedConfig: EncryptedConfigFile = JSON.parse(fileContent);

      const decryptedData = this.decrypt(encryptedConfig);
      const rawConfig = JSON.parse(decryptedData);

      // Validate with Zod schema
      this.config = RidgeCodeConfigSchema.parse(rawConfig);
      return this.config;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        throw new Error(
          'Configuration file not found. Run "ridge-code config init" to create one.'
        );
      } else if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        throw new Error(`Invalid configuration:\n${errorMessages.join('\n')}`);
      } else if (error instanceof SyntaxError) {
        throw new Error('Configuration file contains invalid JSON');
      } else {
        throw new Error(
          `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Save configuration to file
   */
  async save(config?: RidgeCodeConfig): Promise<void> {
    const configToSave = config || this.config;
    if (!configToSave) {
      throw new Error('No configuration to save');
    }

    try {
      // Validate configuration before saving
      const validatedConfig = RidgeCodeConfigSchema.parse(configToSave);

      await this.ensureConfigDir();

      const configJson = JSON.stringify(validatedConfig, null, 2);
      const encryptedConfig = this.encrypt(configJson);

      await fs.writeFile(this.configPath, JSON.stringify(encryptedConfig, null, 2));
      this.config = validatedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(
          (err: any) => `${err.path.join('.')}: ${err.message}`
        );
        throw new Error(`Invalid configuration:\n${errorMessages.join('\n')}`);
      } else {
        throw new Error(
          `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Get configuration value with environment variable override support
   */
  async get(keyPath: string): Promise<any> {
    // Check for environment variable override first
    const envOverride = this.getEnvOverride(keyPath);
    if (envOverride !== undefined) {
      // Convert string env vars to appropriate types
      if (keyPath.includes('showThinking')) return envOverride.toLowerCase() === 'true';
      if (keyPath.includes('maxResponseBuffer')) return parseInt(envOverride, 10);
      return envOverride;
    }

    // Load config if not already loaded
    if (!this.config) {
      await this.load();
    }

    return this.getNestedValue(this.config, keyPath);
  }

  /**
   * Get configuration value for display (masks API keys)
   */
  async getForDisplay(keyPath: string): Promise<any> {
    const value = await this.get(keyPath);

    // Mask API keys for security
    if (keyPath.includes('apiKey') && typeof value === 'string' && value.length > 0) {
      return this.maskApiKey(value);
    }

    return value;
  }

  /**
   * Mask API key for display purposes
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length === 0) {
      return '(not set)';
    }

    if (apiKey.length <= 12) {
      // For short keys, show first 4 and last 4 chars
      return apiKey.substring(0, 4) + '***' + apiKey.slice(-4);
    }

    // For longer keys, show first 8 and last 4 chars
    return apiKey.substring(0, 8) + '*'.repeat(Math.max(0, apiKey.length - 12)) + apiKey.slice(-4);
  }

  /**
   * Set configuration value with validation
   */
  async set(keyPath: string, value: any): Promise<void> {
    // Validate the config path first
    this.validateConfigPath(keyPath);
    
    // Validate the value based on path
    this.validateConfigValue(keyPath, value);

    // Load config if not already loaded
    if (!this.config) {
      try {
        await this.load();
      } catch (error) {
        // If config doesn't exist, create default structure
        this.config = await this.createDefaultConfig();
      }
    }

    // Create a copy to avoid mutations
    const updatedConfig = JSON.parse(JSON.stringify(this.config));
    this.setNestedValue(updatedConfig, keyPath, value);

    // Save the updated configuration
    await this.save(updatedConfig);
  }

  /**
   * Create default configuration structure
   */
  private async createDefaultConfig(): Promise<RidgeCodeConfig> {
    return RidgeCodeConfigSchema.parse({
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
  }

  /**
   * Initialize configuration with default values
   */
  async init(): Promise<void> {
    const defaultConfig = await this.createDefaultConfig();
    await this.save(defaultConfig);
  }

  /**
   * Check if configuration file exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current configuration object
   */
  getConfig(): RidgeCodeConfig | null {
    return this.config;
  }

  /**
   * Clear cached configuration (forces reload on next access)
   */
  clearCache(): void {
    this.config = null;
  }

  /**
   * Validate configuration path to prevent invalid paths
   */
  private validateConfigPath(keyPath: string): void {
    // Define valid configuration paths
    const validPaths = [
      // Model configurations
      /^models\.(anthropic|openai|xai)\.(apiKey|model)$/,
      // AIDIS configurations
      /^aidis\.(mcpEndpoint|httpBridge|authMethod)$/,
      // UI configurations
      /^ui\.(maxResponseBuffer|showThinking)$/
    ];

    const isValid = validPaths.some(pattern => pattern.test(keyPath));
    
    if (!isValid) {
      throw new Error(
        `Invalid configuration path: ${keyPath}\n` +
        `Valid paths:\n` +
        `  • models.{provider}.apiKey - Set API keys for providers (anthropic, openai, xai)\n` +
        `  • models.{provider}.model - Set model for provider\n` +
        `  • aidis.mcpEndpoint - AIDIS MCP endpoint\n` +
        `  • aidis.httpBridge - AIDIS HTTP bridge URL\n` +
        `  • ui.maxResponseBuffer - Response buffer size\n` +
        `  • ui.showThinking - Show AI thinking process`
      );
    }
  }

  /**
   * Validate configuration values based on their paths
   */
  private validateConfigValue(keyPath: string, value: any): void {
    // API Key validation
    if (keyPath.includes('.apiKey')) {
      if (typeof value !== 'string') {
        throw new Error('API keys must be strings');
      }
      
      if (value.length > 0 && value.length < 8) {
        throw new Error('API key appears too short. Please verify it\'s correct.');
      }

      // Validate API key format for known providers
      if (keyPath.includes('models.anthropic.apiKey') && value) {
        if (!value.startsWith('sk-ant-')) {
          console.warn('⚠️  Warning: Anthropic API keys typically start with "sk-ant-"');
        }
      }
      
      if (keyPath.includes('models.openai.apiKey') && value) {
        if (!value.startsWith('sk-')) {
          console.warn('⚠️  Warning: OpenAI API keys typically start with "sk-"');
        }
      }
    }

    // Model validation
    if (keyPath.includes('.model')) {
      if (typeof value !== 'string' || !value) {
        throw new Error('Model names must be non-empty strings');
      }

      // Known valid models for each provider
      const validModels: Record<string, string[]> = {
        anthropic: [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022', 
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ],
        openai: [
          'gpt-4',
          'gpt-4-turbo',
          'gpt-4-turbo-preview',
          'gpt-3.5-turbo'
        ],
        xai: [
          'grok-beta',
          'grok-1'
        ]
      };

      const provider = keyPath.split('.')[1];
      const knownModels = provider ? (validModels[provider] || []) : [];
      
      if (knownModels.length > 0 && !knownModels.includes(value)) {
        console.warn(
          `⚠️  Warning: '${value}' is not in the list of known ${provider} models.\n` +
          `   Known models: ${knownModels.join(', ')}\n` +
          `   The model might still work if it exists on the provider's platform.`
        );
      }
    }

    // Numeric validation
    if (keyPath === 'ui.maxResponseBuffer') {
      const num = Number(value);
      if (isNaN(num) || num < 1000 || num > 100000) {
        throw new Error('ui.maxResponseBuffer must be a number between 1000 and 100000');
      }
    }

    // Boolean validation  
    if (keyPath === 'ui.showThinking') {
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (!['true', 'false'].includes(lowerValue)) {
          throw new Error('ui.showThinking must be true or false');
        }
      } else if (typeof value !== 'boolean') {
        throw new Error('ui.showThinking must be true or false');
      }
    }

    // AIDIS endpoint validation
    if (keyPath === 'aidis.mcpEndpoint') {
      if (typeof value !== 'string' || !value) {
        throw new Error('AIDIS MCP endpoint must be a non-empty string');
      }
      
      if (!value.startsWith('stdio://') && !value.startsWith('http://') && !value.startsWith('https://')) {
        console.warn('⚠️  Warning: AIDIS endpoint should typically start with stdio://, http://, or https://');
      }
    }
  }

  /**
   * Get configuration for a specific provider
   */
  async getProviderConfig(name: string): Promise<ProviderConfig | undefined> {
    if (!this.config) {
      await this.load();
    }

    const provider = this.config?.models?.[name as keyof typeof this.config.models];
    if (!provider) return undefined;

    // Check for environment variable overrides
    const apiKeyOverride = this.getEnvOverride(`models.${name}.apiKey`);
    const modelOverride = this.getEnvOverride(`models.${name}.model`);

    return {
      apiKey: apiKeyOverride || provider.apiKey,
      model: modelOverride || provider.model,
    };
  }

  /**
   * List all configured providers
   */
  async listProviders(): Promise<string[]> {
    if (!this.config) {
      await this.load();
    }

    return this.config?.models ? Object.keys(this.config.models) : [];
  }

  /**
   * Set configuration for a specific provider
   */
  async setProviderConfig(name: string, config: ProviderConfig): Promise<void> {
    // Load config if not already loaded
    if (!this.config) {
      try {
        await this.load();
      } catch (error) {
        // If config doesn't exist, create default structure
        this.config = await this.createDefaultConfig();
      }
    }

    // Create a copy to avoid mutations
    const updatedConfig = JSON.parse(JSON.stringify(this.config));

    // Initialize models object if it doesn't exist
    if (!updatedConfig.models) {
      updatedConfig.models = {};
    }

    // Set the provider configuration
    updatedConfig.models[name] = {
      apiKey: config.apiKey,
      model: config.model,
    };

    // Save the updated configuration
    await this.save(updatedConfig);
  }

  /**
   * Remove a provider from configuration
   */
  async removeProvider(name: string): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    if (!this.config?.models?.[name as keyof typeof this.config.models]) {
      throw new Error(`Provider '${name}' not found in configuration`);
    }

    // Create a copy to avoid mutations
    const updatedConfig = JSON.parse(JSON.stringify(this.config));
    delete updatedConfig.models[name];

    // Save the updated configuration
    await this.save(updatedConfig);
  }

  /**
   * Get all provider configurations with environment overrides applied
   */
  async getAllProviderConfigs(): Promise<Record<string, ProviderConfig>> {
    const providers = await this.listProviders();
    const configs: Record<string, ProviderConfig> = {};

    for (const provider of providers) {
      const config = await this.getProviderConfig(provider);
      if (config) {
        configs[provider] = config;
      }
    }

    return configs;
  }

  /**
   * Check if a provider is configured (has API key)
   */
  async isProviderConfigured(name: string): Promise<boolean> {
    const config = await this.getProviderConfig(name);
    return !!(config?.apiKey && config.apiKey.trim() !== '');
  }
}
