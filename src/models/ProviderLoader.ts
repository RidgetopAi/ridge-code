import { ModelProvider } from './ModelProvider';

/**
 * Dynamic provider loader for lazy loading of different AI providers
 * Supports graceful fallbacks when providers are not available
 */
export class ProviderLoader {
  /**
   * Load a provider by name with dynamic imports
   */
  static async loadProvider(name: string): Promise<new () => ModelProvider> {
    try {
      switch (name.toLowerCase()) {
        case 'anthropic': {
          const { AnthropicProvider } = await import('./AnthropicProvider');
          return AnthropicProvider;
        }

        case 'openai': {
          // Future: OpenAI provider implementation
          throw new Error('OpenAI provider not yet implemented');
        }

        case 'xai': {
          // Future: XAI provider implementation
          throw new Error('XAI provider not yet implemented');
        }

        default:
          throw new Error(`Unknown provider: ${name}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw with context
        throw new Error(`Failed to load provider '${name}': ${error.message}`);
      }
      throw new Error(`Failed to load provider '${name}': ${String(error)}`);
    }
  }

  /**
   * Get list of available providers (ones we can actually load)
   */
  static getAvailableProviders(): string[] {
    return ['anthropic']; // Add 'openai', 'xai' when implemented
  }

  /**
   * Check if a provider is available for loading
   */
  static isProviderAvailable(name: string): boolean {
    return this.getAvailableProviders().includes(name.toLowerCase());
  }
}
