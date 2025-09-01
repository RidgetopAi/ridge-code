#!/usr/bin/env node

// Ridge-Code CLI Entry Point
// This script bootstraps the TypeScript application

const path = require('path');
const fs = require('fs');

// Check if we're running from source or built
const distPath = path.join(__dirname, '..', 'dist', 'index.js');
const srcPath = path.join(__dirname, '..', 'src', 'index.ts');

if (fs.existsSync(distPath)) {
  // Production mode - use built JavaScript
  const app = require(distPath);
  if (app.main) {
    app.main().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
} else if (fs.existsSync(srcPath)) {
  // Development mode - use ts-node
  try {
    require('ts-node/register');
    const app = require(srcPath);
    if (app.main) {
      app.main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error('Error: ts-node is required for development mode');
    console.error('Run: npm install ts-node');
    process.exit(1);
  }
} else {
  console.error('Error: Could not find ridge-code application files');
  console.error('Please run "npm run build" first');
  process.exit(1);
}
