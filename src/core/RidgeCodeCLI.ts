import * as readline from 'readline';
import chalk from 'chalk';
import { program } from 'commander';
import { ConfigManager } from './ConfigManager';
import { ModelManager } from '../models/ModelManager';
import { ProviderLoader } from '../models/ProviderLoader';
import { ResponseBuffer } from '../response/ResponseBuffer';
import { AidisMcpClient } from '../aidis/AidisMcpClient';
import { CommandRouter } from './CommandRouter';
import { TerminalRenderer } from './TerminalRenderer';
import { ModelError } from '../types';

/**
 * RidgeCodeCLI - Main orchestrator class that assembles all components
 * into a working interactive CLI
 */
export class RidgeCodeCLI {
  private configManager: ConfigManager;
  private modelManager: ModelManager;
  private responseBuffer: ResponseBuffer;
  private aidisClient: AidisMcpClient;
  private commandRouter: CommandRouter;
  private terminalRenderer: TerminalRenderer;
  private rl: readline.Interface | null = null;
  private isShuttingDown = false;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.modelManager = new ModelManager();
    this.responseBuffer = new ResponseBuffer();
    // Initialize AIDIS client with default config - will be updated in initializeServices
    this.aidisClient = new AidisMcpClient({
      baseUrl: 'http://localhost:8080',
    });
    this.commandRouter = new CommandRouter(this.responseBuffer, this.aidisClient);
    this.terminalRenderer = new TerminalRenderer();

    // Set up graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Main entry point - handles command line arguments and routing
   */
  async start(): Promise<void> {
    try {
      await this.setupCommander();

      // If no command line args, start interactive mode
      if (process.argv.length <= 2) {
        await this.startInteractiveMode();
      } else {
        // Process command line arguments
        await program.parseAsync();
      }
    } catch (error) {
      console.error(chalk.red('✗ Fatal error:'), this.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Set up commander.js command line interface
   */
  private async setupCommander(): Promise<void> {
    program
      .name('ridge-code')
      .description(
        'CLI tool for cost-effective AIDIS interactions with intelligent response parsing'
      )
      .version('1.0.0');

    // Configuration commands
    program
      .command('config')
      .description('Configuration management')
      .argument('<action>', 'init, set, get, or show')
      .argument('[key]', 'configuration key (for set/get)')
      .argument('[value]', 'configuration value (for set)')
      .option('--show', 'show complete configuration')
      .action(async (action, key, value, options) => {
        // Handle --show option
        if (options.show || action === 'show') {
          await this.handleConfigCommand('show');
        } else {
          await this.handleConfigCommand(action, key, value);
        }
      });

    // Chat command
    program
      .command('chat')
      .description('Start interactive chat mode or send a single message')
      .argument('[message]', 'single message to send')
      .option('-i, --interactive', 'start interactive mode after message')
      .action(async (message, options) => {
        if (message) {
          await this.sendSingleMessage(message);
          if (options.interactive) {
            await this.startInteractiveMode();
          }
        } else {
          await this.startInteractiveMode();
        }
      });

    // Provider management command (preparation for future expansion)
    program
      .command('provider')
      .description('Provider management operations')
      .argument('[action]', 'list, status, or switch')
      .argument('[name]', 'provider name (for switch)')
      .action(async (action = 'list', name) => {
        await this.handleProviderCommand(action, name);
      });

    // AIDIS commands
    program
      .command('aidis')
      .description('AIDIS operations')
      .argument('<action>', 'ping, store, or status')
      .argument('[options...]', 'additional options for the command')
      .action(async (action, options) => {
        await this.handleAidisCommand(action, options);
      });
  }

  /**
   * Handle configuration commands
   */
  private async handleConfigCommand(action: string, key?: string, value?: string): Promise<void> {
    try {
      switch (action) {
        case 'init':
          await this.configManager.init();
          console.log(chalk.green('✓ Configuration initialized successfully'));
          console.log(chalk.cyan('Configure your API keys using:'));
          console.log(chalk.white('  ridge-code config set models.anthropic.apiKey "your-api-key"'));
          console.log(chalk.white('  ridge-code config set models.openai.apiKey "your-api-key"'));
          console.log(chalk.white('  ridge-code config set models.xai.apiKey "your-api-key"'));
          break;

        case 'set':
          if (!key || value === undefined) {
            console.error(chalk.red('✗ Usage: ridge-code config set <key> <value>'));
            return;
          }

          // Validate config key format
          const validKeyPatterns = [
            /^models\.(anthropic|openai|xai)\.(apiKey|model)$/,
            /^aidis\.(mcpEndpoint|httpBridge|authMethod)$/,
            /^ui\.(maxResponseBuffer|showThinking)$/
          ];
          
          if (!validKeyPatterns.some(pattern => pattern.test(key))) {
            console.error(chalk.red(`✗ Invalid config key: ${key}`));
            console.error(chalk.yellow('Valid keys:'));
            console.error(chalk.white('  models.<provider>.apiKey (anthropic, openai, xai)'));
            console.error(chalk.white('  models.<provider>.model'));
            console.error(chalk.white('  aidis.mcpEndpoint, ui.maxResponseBuffer, ui.showThinking'));
            return;
          }

          await this.configManager.set(key, value);

          // Mask API key in output for security
          const displayValue = key.includes('apiKey') && typeof value === 'string'
            ? value.substring(0, 8) + '*'.repeat(Math.max(0, value.length - 12)) + value.slice(-4)
            : value;

          console.log(chalk.green(`✓ Set ${key} = ${displayValue}`));
          break;

        case 'get': {
          if (!key) {
            console.error(chalk.red('✗ Usage: ridge-code config get <key>'));
            return;
          }
          const configValue = await this.configManager.getForDisplay(key);
          console.log(chalk.blue(`${key} = ${configValue}`));
          break;
        }

        case 'show': {
          try {
            const config = await this.configManager.load();
            this.terminalRenderer.renderInfo('Current configuration:');

            // Prepare configuration data for table rendering
            const configData = [];

            // Models configuration
            for (const [provider, modelConfig] of Object.entries(config.models)) {
              const maskedKey = await this.configManager.getForDisplay(`models.${provider}.apiKey`);
              configData.push(
                { category: 'Models', key: `${provider}.model`, value: modelConfig.model },
                { category: 'Models', key: `${provider}.apiKey`, value: maskedKey }
              );
            }

            // AIDIS configuration
            configData.push({
              category: 'AIDIS',
              key: 'mcpEndpoint',
              value: config.aidis.mcpEndpoint,
            });

            // UI configuration
            configData.push(
              {
                category: 'UI',
                key: 'maxResponseBuffer',
                value: config.ui.maxResponseBuffer.toString(),
              },
              { category: 'UI', key: 'showThinking', value: config.ui.showThinking.toString() }
            );

            this.terminalRenderer.renderTable(configData);
          } catch (error) {
            this.terminalRenderer.renderWarning(
              'No configuration found. Run "ridge-code config init" first.'
            );
          }
          break;
        }

        default:
          console.error(chalk.red(`✗ Unknown config action: ${action}`));
          console.error('Available actions: init, set, get, show');
          break;
      }
    } catch (error) {
      this.terminalRenderer.renderError(
        new Error(`Configuration error: ${this.formatError(error)}`)
      );
      process.exit(1);
    }
  }

  /**
   * Handle provider management commands
   */
  private async handleProviderCommand(action: string, name?: string): Promise<void> {
    try {
      switch (action) {
        case 'list': {
          this.terminalRenderer.renderInfo('Available Providers');

          const availableProviders = ProviderLoader.getAvailableProviders();
          const configuredProviders = await this.configManager.listProviders();

          const providerData = availableProviders.map(provider => {
            const isConfigured = configuredProviders.includes(provider);
            const status = isConfigured ? 'Configured' : 'Available';
            return {
              provider: provider,
              status: status,
              details: isConfigured ? 'Ready to use' : 'Requires configuration',
            };
          });

          this.terminalRenderer.renderTable(providerData);
          break;
        }

        case 'status': {
          // Initialize services to check provider status
          await this.initializeServices();

          this.terminalRenderer.renderInfo('Provider Status');

          const activeProvider = this.modelManager.activeProvider;
          if (activeProvider) {
            const stats = activeProvider.getUsageStats();
            const statusData = [
              {
                component: 'Active Provider',
                status: activeProvider.name,
                details: `${stats.totalRequests} requests, $${stats.totalCostUSD.toFixed(4)}`,
              },
            ];
            this.terminalRenderer.renderTable(statusData);
          } else {
            this.terminalRenderer.renderWarning('No active provider');
          }
          break;
        }

        case 'switch': {
          if (!name) {
            console.error(chalk.red('✗ Usage: ridge-code provider switch <name>'));
            return;
          }
          // Future: Implement provider switching
          this.terminalRenderer.renderWarning(
            `Provider switching not yet implemented. Use config to change default provider.`
          );
          break;
        }

        default:
          console.error(chalk.red(`✗ Unknown provider action: ${action}`));
          console.error('Available actions: list, status, switch');
          break;
      }
    } catch (error) {
      this.terminalRenderer.renderError(new Error(`Provider error: ${this.formatError(error)}`));
    }
  }

  /**
   * Handle AIDIS commands
   */
  private async handleAidisCommand(action: string, options: string[]): Promise<void> {
    try {
      switch (action) {
        case 'ping': {
          // Initialize connections for ping
          await this.initializeServices();
          const result = await this.commandRouter.routeCommand('/aidis_ping');
          if (result.success) {
            this.terminalRenderer.renderSuccess(result.output || 'AIDIS ping successful');
          } else {
            this.terminalRenderer.renderError(new Error(result.error || 'AIDIS ping failed'));
          }
          break;
        }

        case 'store': {
          // Initialize connections for store
          await this.initializeServices();
          if (options.length === 0) {
            this.terminalRenderer.renderError(
              new Error('Usage: ridge-code aidis store --context|--task')
            );
            return;
          }
          const storeResult = await this.commandRouter.routeCommand(
            `/aidis_store ${options.join(' ')}`
          );
          if (storeResult.success) {
            this.terminalRenderer.renderSuccess(storeResult.output || 'Data stored successfully');
          } else {
            this.terminalRenderer.renderError(
              new Error(storeResult.error || 'Store operation failed')
            );
          }
          break;
        }

        case 'status': {
          // Status doesn't require full initialization
          this.terminalRenderer.renderInfo('AIDIS Status');

          const statusData = [
            {
              component: 'AIDIS Connection',
              status: this.aidisClient.isConnected() ? 'Connected' : 'Disconnected',
              details: this.aidisClient.isConnected()
                ? 'Ready'
                : 'Run command with connection needed',
            },
            {
              component: 'Response Buffer',
              status: 'Active',
              details: `${this.responseBuffer.size}/${ResponseBuffer.maxSize} responses`,
            },
          ];

          // Try to check configuration without requiring it
          try {
            await this.configManager.load();
            statusData.push({
              component: 'Configuration',
              status: 'Loaded',
              details: 'Ready for use',
            });
          } catch (error) {
            statusData.push({
              component: 'Configuration',
              status: 'Not Found',
              details: 'Run "config init"',
            });
          }

          this.terminalRenderer.renderTable(statusData);
          break;
        }

        default:
          console.error(chalk.red(`✗ Unknown AIDIS action: ${action}`));
          console.error('Available actions: ping, store, status');
          break;
      }
    } catch (error) {
      this.terminalRenderer.renderError(new Error(`AIDIS error: ${this.formatError(error)}`));
    }
  }

  /**
   * Send a single message without entering interactive mode
   */
  private async sendSingleMessage(message: string): Promise<void> {
    try {
      await this.initializeServices();

      console.log(chalk.blue('◐ Sending message to Anthropic...'));

      // Stream the response with enhanced rendering
      let response = '';
      const messageStream = this.modelManager.activeProvider.sendMessage(message);

      // Use the terminal renderer for enhanced streaming display
      for await (const chunk of messageStream) {
        response += chunk;
        process.stdout.write(this.terminalRenderer.formatInlineText(chunk));
      }

      // Add response to buffer
      this.responseBuffer.addResponse(response);

      console.log(); // New line after response

      // Show usage stats
      const stats = this.modelManager.activeProvider.getUsageStats();
      console.log(
        chalk.dim(
          `[${stats.totalInputTokens + stats.totalOutputTokens} tokens, $${stats.totalCostUSD.toFixed(4)}]`
        )
      );
    } catch (error) {
      this.terminalRenderer.renderError(
        new Error(`Error sending message: ${this.formatError(error)}`)
      );
    }
  }

  /**
   * Start interactive chat mode
   */
  private async startInteractiveMode(): Promise<void> {
    try {
      await this.initializeServices();

      console.log(chalk.green('✓ Ridge-Code CLI started'));
      console.log(chalk.yellow('Type your messages to chat with Claude'));
      console.log(chalk.yellow('Use /commands (like /aidis_ping, /help) for special actions'));
      console.log(chalk.dim('Press Ctrl+C to exit\n'));

      // Create readline interface
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('ridge-code> '),
      });

      // Start the interactive loop
      this.rl.prompt();

      this.rl.on('line', async (input: string): Promise<void> => {
        await this.handleInteractiveInput(input.trim());
      });

      this.rl.on('close', (): void => {
        this.shutdown();
      });
    } catch (error) {
      console.error(chalk.red('✗ Failed to start interactive mode:'), this.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Handle user input in interactive mode
   */
  private async handleInteractiveInput(input: string): Promise<void> {
    if (this.isShuttingDown || !this.rl) return;

    try {
      // Handle empty input
      if (!input) {
        this.rl.prompt();
        return;
      }

      // Check if it's a command
      if (input.startsWith('/')) {
        const result = await this.commandRouter.routeCommand(input);

        if (result.success) {
          if (result.output) {
            // Check if output contains markdown or structured data
            if (
              result.output.includes('```') ||
              result.output.includes('#') ||
              result.output.includes('|')
            ) {
              this.terminalRenderer.renderMarkdown(result.output);
            } else {
              this.terminalRenderer.renderSuccess(result.output);
            }
          } else {
            this.terminalRenderer.renderSuccess('Command executed successfully');
          }
        } else {
          this.terminalRenderer.renderError(new Error(result.error || 'Command failed'));
        }

        this.rl.prompt();
        return;
      }

      // Regular chat message - stream the response
      console.log(chalk.blue('◐ Thinking...'));

      // Clear the "thinking" line once before streaming
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      let response = '';
      const messageStream = this.modelManager.activeProvider.sendMessage(input);

      // Use simple streaming to avoid duplication
      for await (const chunk of messageStream) {
        response += chunk;
        process.stdout.write(this.terminalRenderer.formatInlineText(chunk));
      }

      // Add response to buffer for potential AIDIS extraction
      this.responseBuffer.addResponse(response);

      console.log(); // New line after response

      // Show usage stats
      const stats = this.modelManager.activeProvider.getUsageStats();
      console.log(
        chalk.dim(
          `[${stats.totalInputTokens + stats.totalOutputTokens} tokens, $${stats.totalCostUSD.toFixed(4)}]`
        )
      );
    } catch (error) {
      this.terminalRenderer.renderError(new Error(this.formatError(error)));
    }

    if (this.rl && !this.isShuttingDown) {
      this.rl.prompt();
    }
  }

  /**
   * Initialize all services and verify connections
   */
  private async initializeServices(): Promise<void> {
    try {
      // Load configuration
      await this.configManager.load();

      // Oracle bootstrap pattern: Load and register all configured providers
      await this.initializeProviders();

      // Initialize AIDIS client (but don't require connection)
      try {
        await this.aidisClient.connect();
      } catch (error) {
        console.log(
          chalk.yellow('⚠ AIDIS connection failed (commands will not work):'),
          this.formatError(error)
        );
      }
    } catch (error) {
      throw new Error(`Service initialization failed: ${this.formatError(error)}`);
    }
  }

  /**
   * Initialize all configured providers using Oracle bootstrap pattern
   */
  private async initializeProviders(): Promise<void> {
    const configuredProviders = await this.configManager.listProviders();
    let successfullyLoaded = 0;
    const errors: string[] = [];

    for (const providerName of configuredProviders) {
      try {
        // Get provider configuration
        const providerConfig = await this.configManager.getProviderConfig(providerName);
        if (!providerConfig) {
          errors.push(`No configuration found for provider: ${providerName}`);
          continue;
        }

        // Check if provider is available for loading
        if (!ProviderLoader.isProviderAvailable(providerName)) {
          errors.push(`Provider '${providerName}' is not yet implemented`);
          continue;
        }

        // Check for required API key
        if (!providerConfig.apiKey) {
          errors.push(
            `API key not configured for ${providerName}. Run "ridge-code config set models.${providerName}.apiKey YOUR_KEY"`
          );
          continue;
        }

        // Dynamically load the provider
        const ProviderClass = await ProviderLoader.loadProvider(providerName);
        const provider = new ProviderClass();

        // Initialize with configuration
        await provider.init(providerConfig);

        // Register with ModelManager
        this.modelManager.register(provider);
        successfullyLoaded++;

        console.log(chalk.green(`✓ Loaded provider: ${providerName}`));
      } catch (error) {
        const errorMsg = `Failed to load provider '${providerName}': ${this.formatError(error)}`;
        errors.push(errorMsg);
        console.log(chalk.yellow(`⚠ ${errorMsg}`));
      }
    }

    // Validate we have at least one working provider
    if (successfullyLoaded === 0) {
      if (errors.length > 0) {
        throw new Error(`No providers could be loaded:\n${errors.map(e => `  • ${e}`).join('\n')}`);
      } else {
        throw new Error(
          'No providers configured. Run "ridge-code config init" and configure at least one provider.'
        );
      }
    }

    console.log(
      chalk.dim(`Loaded ${successfullyLoaded} of ${configuredProviders.length} providers`)
    );
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = (): void => {
      this.shutdown();
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGHUP', shutdownHandler);
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    console.log(chalk.yellow('\n✓ Shutting down gracefully...'));

    // Close readline interface
    if (this.rl) {
      this.rl.close();
    }

    // Disconnect AIDIS client
    if (this.aidisClient.isConnected()) {
      this.aidisClient.disconnect();
    }

    // Shutdown model manager
    this.modelManager.shutdown().catch(() => {
      // Ignore shutdown errors during cleanup
    });

    // Show final usage stats
    try {
      const stats = this.modelManager.activeProvider.getUsageStats();
      if (stats.totalRequests > 0) {
        console.log(
          chalk.dim(
            `Session stats: ${stats.totalRequests} requests, ${stats.totalInputTokens + stats.totalOutputTokens} tokens, $${stats.totalCostUSD.toFixed(4)}`
          )
        );
      }
    } catch (error) {
      // Ignore stats errors during shutdown
    }

    console.log(chalk.green('✓ Goodbye!'));
    process.exit(0);
  }

  /**
   * Format error messages consistently
   */
  private formatError(error: unknown): string {
    if (error && typeof error === 'object' && 'retryable' in error) {
      const modelError = error as ModelError;
      return modelError.message + (modelError.retryable ? ' (retryable)' : '');
    } else if (error instanceof Error) {
      return error.message;
    } else {
      return String(error);
    }
  }
}
