import { Command } from 'commander';
import chalk from 'chalk';
import { CliConfig } from '../types';
import { ConfigManager } from './ConfigManager';

export class RidgeCLI {
  private program: Command;
  private config: CliConfig;
  private configManager: ConfigManager;

  constructor(config: CliConfig) {
    this.config = config;
    this.configManager = ConfigManager.getInstance();
    this.program = new Command();
    this.setupProgram();
    this.setupConfigCommands();
  }

  private setupProgram(): void {
    this.program
      .name('ridge-code')
      .description(
        'CLI tool for cost-effective AIDIS interactions with intelligent response parsing'
      )
      .version('1.0.0');
  }

  private setupConfigCommands(): void {
    const configCmd = this.program
      .command('config')
      .description('Configuration management commands');

    // config init
    configCmd
      .command('init')
      .description('Initialize configuration with default values')
      .option('-f, --force', 'Overwrite existing configuration file')
      .action(async (options: { force?: boolean }) => {
        try {
          if ((await this.configManager.exists()) && !options.force) {
            console.log(
              chalk.yellow('Configuration file already exists. Use --force to overwrite.')
            );
            return;
          }

          await this.configManager.init();
          console.log(chalk.green('✓ Configuration initialized successfully'));
          console.log(chalk.cyan('Configure your API keys using:'));
          console.log(
            chalk.white('  ridge-code config set models.anthropic.apiKey "your-api-key"')
          );
          console.log(chalk.white('  ridge-code config set models.openai.apiKey "your-api-key"'));
          console.log(chalk.white('  ridge-code config set models.xai.apiKey "your-api-key"'));
        } catch (error) {
          console.error(
            chalk.red('Failed to initialize configuration:'),
            error instanceof Error ? error.message : 'Unknown error'
          );
          process.exit(1);
        }
      });

    // config get <key>
    configCmd
      .command('get')
      .argument('<key>', 'Configuration key (e.g., models.anthropic.model)')
      .description('Get configuration value')
      .action(async (key: string) => {
        try {
          const value = await this.configManager.get(key);
          if (value === undefined) {
            console.log(chalk.yellow(`Configuration key '${key}' not found`));
            return;
          }

          // Mask API keys for security
          if (key.includes('apiKey') && typeof value === 'string' && value.length > 0) {
            const masked =
              value.substring(0, 8) + '*'.repeat(Math.max(0, value.length - 12)) + value.slice(-4);
            console.log(chalk.green(`${key}:`), masked);
          } else {
            console.log(chalk.green(`${key}:`), value);
          }
        } catch (error) {
          console.error(
            chalk.red('Failed to get configuration:'),
            error instanceof Error ? error.message : 'Unknown error'
          );
          process.exit(1);
        }
      });

    // config set <key> <value>
    configCmd
      .command('set')
      .argument('<key>', 'Configuration key (e.g., models.anthropic.apiKey)')
      .argument('<value>', 'Configuration value')
      .description('Set configuration value')
      .action(async (key: string, value: string) => {
        try {
          // Convert string values to appropriate types
          let parsedValue: any = value;
          if (key.includes('maxResponseBuffer')) {
            parsedValue = parseInt(value, 10);
            if (isNaN(parsedValue)) {
              throw new Error('maxResponseBuffer must be a number');
            }
          } else if (key.includes('showThinking')) {
            parsedValue = value.toLowerCase() === 'true';
          }

          await this.configManager.set(key, parsedValue);

          // Mask API key in output
          const displayValue =
            key.includes('apiKey') && typeof parsedValue === 'string'
              ? parsedValue.substring(0, 8) +
                '*'.repeat(Math.max(0, parsedValue.length - 12)) +
                parsedValue.slice(-4)
              : parsedValue;

          console.log(chalk.green('✓ Configuration updated:'));
          console.log(chalk.cyan(`  ${key}:`), displayValue);
        } catch (error) {
          console.error(
            chalk.red('Failed to set configuration:'),
            error instanceof Error ? error.message : 'Unknown error'
          );
          process.exit(1);
        }
      });

    // config list
    configCmd
      .command('list')
      .description('List all configuration values')
      .option('--show-keys', 'Show API keys (masked for security)')
      .action(async (options: { showKeys?: boolean }) => {
        try {
          const config = await this.configManager.load();
          console.log(chalk.cyan('Current configuration:'));
          console.log();

          // Display models
          console.log(chalk.yellow('Models:'));
          Object.entries(config.models).forEach(([provider, modelConfig]) => {
            console.log(chalk.green(`  ${provider}:`));
            console.log(chalk.white(`    model: ${modelConfig.model}`));
            if (options.showKeys) {
              const maskedKey =
                modelConfig.apiKey.length > 0
                  ? modelConfig.apiKey.substring(0, 8) +
                    '*'.repeat(Math.max(0, modelConfig.apiKey.length - 12)) +
                    modelConfig.apiKey.slice(-4)
                  : '(not set)';
              console.log(chalk.white(`    apiKey: ${maskedKey}`));
            } else {
              console.log(
                chalk.white(`    apiKey: ${modelConfig.apiKey.length > 0 ? '(set)' : '(not set)'}`)
              );
            }
          });

          // Display AIDIS
          console.log(chalk.yellow('AIDIS:'));
          console.log(chalk.white(`  mcpEndpoint: ${config.aidis.mcpEndpoint}`));
          if (config.aidis.httpBridge) {
            console.log(chalk.white(`  httpBridge: ${config.aidis.httpBridge}`));
          }
          console.log(chalk.white(`  authMethod: ${config.aidis.authMethod}`));

          // Display UI
          console.log(chalk.yellow('UI:'));
          console.log(chalk.white(`  maxResponseBuffer: ${config.ui.maxResponseBuffer}`));
          console.log(chalk.white(`  showThinking: ${config.ui.showThinking}`));
        } catch (error) {
          console.error(
            chalk.red('Failed to list configuration:'),
            error instanceof Error ? error.message : 'Unknown error'
          );
          process.exit(1);
        }
      });
  }

  public addCommand(name: string, description: string, action: (...args: unknown[]) => void): void {
    this.program.command(name).description(description).action(action);
  }

  public async run(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  public getProgram(): Command {
    return this.program;
  }
}
