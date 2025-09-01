#!/usr/bin/env node

import { RidgeCLI } from './core/cli';
import { CliConfig } from './types';
import chalk from 'chalk';

const defaultConfig: CliConfig = {
  aidisEndpoint: 'http://localhost:3000',
  logLevel: 'info',
  timeout: 30000,
};

async function main(): Promise<void> {
  const cli = new RidgeCLI(defaultConfig);
  
  // Add basic commands for Phase 1 MVP
  cli.addCommand('ping', 'Test AIDIS connection', () => {
    console.log(chalk.green('✓ AIDIS connection test (placeholder)'));
  });

  cli.addCommand('help', 'Show help information', () => {
    console.log(chalk.yellow('Help system (placeholder)'));
  });

  await cli.run(process.argv);
}

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { main };
