import * as readline from 'readline';
import chalk from 'chalk';
import { program } from 'commander';
import { ConfigManager } from './ConfigManager';
import { AnthropicClient } from '../models/AnthropicClient';
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
  private anthropicClient: AnthropicClient;
  private responseBuffer: ResponseBuffer;
  private aidisClient: AidisMcpClient;
  private commandRouter: CommandRouter;
  private terminalRenderer: TerminalRenderer;
  private rl: readline.Interface | null = null;
  private isShuttingDown = false;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.anthropicClient = new AnthropicClient();
    this.responseBuffer = new ResponseBuffer();
    // Initialize AIDIS client with default config - will be updated in initializeServices
    this.aidisClient = new AidisMcpClient({
      baseUrl: 'http://localhost:8080'
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
      .description('CLI tool for cost-effective AIDIS interactions with intelligent response parsing')
      .version('1.0.0');

    // Configuration commands
    program
      .command('config')
      .description('Configuration management')
      .argument('<action>', 'init, set, get, or show')
      .argument('[key]', 'configuration key (for set/get)')
      .argument('[value]', 'configuration value (for set)')
      .action(async (action, key, value) => {
        await this.handleConfigCommand(action, key, value);
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
          console.log(chalk.green('✓ Configuration initialized'));
          console.log(chalk.yellow('Edit ~/.ridge-code/config.json to set your API keys'));
          break;

        case 'set':
          if (!key || value === undefined) {
            console.error(chalk.red('✗ Usage: ridge-code config set <key> <value>'));
            return;
          }
          await this.configManager.set(key, value);
          console.log(chalk.green(`✓ Set ${key} = ${value}`));
          break;

        case 'get':
          if (!key) {
            console.error(chalk.red('✗ Usage: ridge-code config get <key>'));
            return;
          }
          const configValue = await this.configManager.get(key);
          console.log(chalk.blue(`${key} = ${configValue}`));
          break;

        case 'show':
          try {
            const config = await this.configManager.load();
            this.terminalRenderer.renderInfo('Current configuration:');
            
            // Prepare configuration data for table rendering
            const configData = [];
            
            // Models configuration
            Object.entries(config.models).forEach(([provider, modelConfig]) => {
              const maskedKey = modelConfig.apiKey.length > 0
                ? modelConfig.apiKey.substring(0, 8) + '*'.repeat(Math.max(0, modelConfig.apiKey.length - 12)) + modelConfig.apiKey.slice(-4)
                : '(not set)';
              configData.push(
                { category: 'Models', key: `${provider}.model`, value: modelConfig.model },
                { category: 'Models', key: `${provider}.apiKey`, value: maskedKey }
              );
            });
            
            // AIDIS configuration
            configData.push({ category: 'AIDIS', key: 'mcpEndpoint', value: config.aidis.mcpEndpoint });
            
            // UI configuration
            configData.push(
              { category: 'UI', key: 'maxResponseBuffer', value: config.ui.maxResponseBuffer.toString() },
              { category: 'UI', key: 'showThinking', value: config.ui.showThinking.toString() }
            );
            
            this.terminalRenderer.renderTable(configData);
          } catch (error) {
            this.terminalRenderer.renderWarning('No configuration found. Run "ridge-code config init" first.');
          }
          break;

        default:
          console.error(chalk.red(`✗ Unknown config action: ${action}`));
          console.error('Available actions: init, set, get, show');
          break;
      }
    } catch (error) {
      this.terminalRenderer.renderError(new Error(`Configuration error: ${this.formatError(error)}`));
      process.exit(1);
    }
  }

  /**
   * Handle AIDIS commands
   */
  private async handleAidisCommand(action: string, options: string[]): Promise<void> {
    try {
      switch (action) {
        case 'ping':
          // Initialize connections for ping
          await this.initializeServices();
          const result = await this.commandRouter.routeCommand('/aidis_ping');
          if (result.success) {
            this.terminalRenderer.renderSuccess(result.output || 'AIDIS ping successful');
          } else {
            this.terminalRenderer.renderError(new Error(result.error || 'AIDIS ping failed'));
          }
          break;

        case 'store':
          // Initialize connections for store
          await this.initializeServices();
          if (options.length === 0) {
            this.terminalRenderer.renderError(new Error('Usage: ridge-code aidis store --context|--task'));
            return;
          }
          const storeResult = await this.commandRouter.routeCommand(`/aidis_store ${options.join(' ')}`);
          if (storeResult.success) {
            this.terminalRenderer.renderSuccess(storeResult.output || 'Data stored successfully');
          } else {
            this.terminalRenderer.renderError(new Error(storeResult.error || 'Store operation failed'));
          }
          break;

        case 'status':
          // Status doesn't require full initialization
          this.terminalRenderer.renderInfo('AIDIS Status');
          
          const statusData = [
            { 
              component: 'AIDIS Connection', 
              status: this.aidisClient.isConnected() ? 'Connected' : 'Disconnected',
              details: this.aidisClient.isConnected() ? 'Ready' : 'Run command with connection needed'
            },
            { 
              component: 'Response Buffer', 
              status: 'Active',
              details: `${this.responseBuffer.size}/${ResponseBuffer.maxSize} responses`
            }
          ];
          
          // Try to check configuration without requiring it
          try {
            await this.configManager.load();
            statusData.push({ component: 'Configuration', status: 'Loaded', details: 'Ready for use' });
          } catch (error) {
            statusData.push({ component: 'Configuration', status: 'Not Found', details: 'Run "config init"' });
          }
          
          this.terminalRenderer.renderTable(statusData);
          break;

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
      const messageStream = this.anthropicClient.sendMessage(message);
      
      // Use the terminal renderer for enhanced streaming display
      await this.terminalRenderer.renderStreamingResponse((async function* () {
        for await (const chunk of messageStream) {
          response += chunk;
          yield chunk;
        }
      })());
      
      // Add response to buffer
      this.responseBuffer.addResponse(response);
      
      console.log(); // New line after response
      
      // Show usage stats
      const stats = this.anthropicClient.getUsageStats();
      console.log(chalk.dim(`[${stats.totalInputTokens + stats.totalOutputTokens} tokens, $${stats.totalCost.toFixed(4)}]`));
      
    } catch (error) {
      this.terminalRenderer.renderError(new Error(`Error sending message: ${this.formatError(error)}`));
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
        prompt: chalk.cyan('ridge-code> ')
      });

      // Start the interactive loop
      this.rl.prompt();
      
      this.rl.on('line', async (input) => {
        await this.handleInteractiveInput(input.trim());
      });

      this.rl.on('close', () => {
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
            if (result.output.includes('```') || result.output.includes('#') || result.output.includes('|')) {
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
      const messageStream = this.anthropicClient.sendMessage(input);
      
      // Use the terminal renderer for streaming with markdown support
      await this.terminalRenderer.renderStreamingResponse((async function* () {
        for await (const chunk of messageStream) {
          response += chunk;
          yield chunk;
        }
      })());
      
      // Add response to buffer for potential AIDIS extraction
      this.responseBuffer.addResponse(response);
      
      console.log(); // New line after response
      
      // Show usage stats
      const stats = this.anthropicClient.getUsageStats();
      console.log(chalk.dim(`[${stats.totalInputTokens + stats.totalOutputTokens} tokens, $${stats.totalCost.toFixed(4)}]`));
      
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
      
      // Initialize Anthropic client
      await this.anthropicClient.init();
      
      // Initialize AIDIS client (but don't require connection)
      try {
        await this.aidisClient.connect();
      } catch (error) {
        console.log(chalk.yellow('⚠ AIDIS connection failed (commands will not work):'), this.formatError(error));
      }
      
    } catch (error) {
      throw new Error(`Service initialization failed: ${this.formatError(error)}`);
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = () => {
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
    
    // Show final usage stats
    const stats = this.anthropicClient.getUsageStats();
    if (stats.totalRequests > 0) {
      console.log(chalk.dim(`Session stats: ${stats.totalRequests} requests, ${stats.totalInputTokens + stats.totalOutputTokens} tokens, $${stats.totalCost.toFixed(4)}`));
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
