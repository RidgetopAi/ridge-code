import { ModelProvider, UsageStats } from './ModelProvider';

export class ModelManager {
  private providers = new Map<string, ModelProvider>();
  private active = 'anthropic';

  /**
   * Register a model provider
   * @param provider - The provider to register
   * @throws Error if provider is invalid
   */
  register(provider: ModelProvider): void {
    if (!provider.name) {
      throw new Error('Provider must have a name');
    }

    if (this.providers.has(provider.name)) {
      throw new Error(`Provider '${provider.name}' is already registered`);
    }

    this.providers.set(provider.name, provider);
  }

  /**
   * Switch to a different provider
   * @param name - Name of the provider to switch to
   * @throws Error if provider is not found
   */
  async switch(name: string): Promise<void> {
    if (!this.providers.has(name)) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(`Unknown provider '${name}'. Available providers: ${available || 'none'}`);
    }
    this.active = name;
  }

  /**
   * Get the currently active provider
   * @throws Error if no active provider is available
   */
  get activeProvider(): ModelProvider {
    const provider = this.providers.get(this.active);
    if (!provider) {
      throw new Error(
        `Active provider '${this.active}' is not available. Please register it first.`
      );
    }
    return provider;
  }

  /**
   * Get the name of the currently active provider
   */
  get activeProviderName(): string {
    return this.active;
  }

  /**
   * List all registered provider names
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Get provider status information
   */
  getStatus(): {
    activeProvider: string;
    totalProviders: number;
    availableProviders: string[];
  } {
    return {
      activeProvider: this.active,
      totalProviders: this.providers.size,
      availableProviders: this.listProviders(),
    };
  }

  /**
   * Get usage statistics for all registered providers
   */
  stats(): Record<string, UsageStats> {
    const out: Record<string, UsageStats> = {};
    for (const [k, p] of this.providers) {
      out[k] = p.getUsageStats();
    }
    return out;
  }

  /**
   * Get a specific provider by name
   * @param name - Provider name
   * @throws Error if provider is not found
   */
  getProvider(name: string): ModelProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' is not registered`);
    }
    return provider;
  }

  /**
   * Unregister a provider
   * @param name - Provider name to remove
   * @throws Error if trying to remove active provider
   */
  async unregister(name: string): Promise<void> {
    if (!this.providers.has(name)) {
      return; // Silently ignore if provider doesn't exist
    }

    if (name === this.active) {
      throw new Error(
        `Cannot unregister active provider '${name}'. Switch to another provider first.`
      );
    }

    const provider = this.providers.get(name);
    if (provider?.close) {
      await provider.close();
    }

    this.providers.delete(name);
  }

  /**
   * Clean shutdown - closes all providers
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const provider of this.providers.values()) {
      if (provider.close) {
        promises.push(provider.close());
      }
    }

    await Promise.all(promises);
    this.providers.clear();
  }
}
