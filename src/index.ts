#!/usr/bin/env node

import { RidgeCodeCLI } from './core/RidgeCodeCLI';
import chalk from 'chalk';

/**
 * Main entry point for Ridge-Code CLI
 * Assembles all components into a working interactive CLI
 */
async function main(): Promise<void> {
  try {
    const cli = new RidgeCodeCLI();
    await cli.start();
  } catch (error) {
    console.error(chalk.red('✗ Failed to start Ridge-Code CLI:'), error);
    process.exit(1);
  }
}

// Run main if this is the entry point
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { main };
