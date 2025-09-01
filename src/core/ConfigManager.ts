import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { z } from 'zod';

// Configuration schema with Zod validation
const RidgeCodeConfigSchema = z.object({
  models: z.object({
    anthropic: z.object({
      apiKey: z.string(),
      model: z.string().default('claude-3-5-sonnet-20241022'),
    }),
    openai: z.object({
      apiKey: z.string(),
      model: z.string().default('gpt-4'),
    }),
    xai: z.object({
      apiKey: z.string(),
      model: z.string().default('grok-beta'),
    }),
  }),
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
    const envMappings: Record<string, string> = {
      'models.anthropic.apiKey': 'RIDGE_CODE_ANTHROPIC_KEY',
      'models.anthropic.model': 'RIDGE_CODE_ANTHROPIC_MODEL',
      'models.openai.apiKey': 'RIDGE_CODE_OPENAI_KEY',
      'models.openai.model': 'RIDGE_CODE_OPENAI_MODEL',
      'models.xai.apiKey': 'RIDGE_CODE_XAI_KEY',
      'models.xai.model': 'RIDGE_CODE_XAI_MODEL',
      'aidis.mcpEndpoint': 'RIDGE_CODE_AIDIS_ENDPOINT',
      'aidis.httpBridge': 'RIDGE_CODE_AIDIS_BRIDGE',
      'ui.maxResponseBuffer': 'RIDGE_CODE_MAX_BUFFER',
      'ui.showThinking': 'RIDGE_CODE_SHOW_THINKING',
    };

    const envVar = envMappings[keyPath];
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
   * Set configuration value
   */
  async set(keyPath: string, value: any): Promise<void> {
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
}
