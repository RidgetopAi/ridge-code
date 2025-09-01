# Ridge-Code CLI

> Cost-effective AIDIS interactions with intelligent response parsing

## Overview

Ridge-Code is a TypeScript CLI tool designed to reduce AIDIS tool call costs through intelligent response parsing and caching. This is the Phase 1 MVP implementation with 3 core commands.

## Project Structure

```
ridge-code/
├── src/
│   ├── core/           # CLI engine components
│   ├── models/         # Provider adapters
│   ├── aidis/          # AIDIS integration
│   ├── response/       # Response handling
│   └── types/          # TypeScript interfaces
├── config/             # User configuration
├── bin/                # Executable entry point
└── tests/              # Test files
```

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Version check
./bin/ridge-code.js --version

# Help
./bin/ridge-code.js --help

# Available commands (Phase 1 MVP)
./bin/ridge-code.js ping    # Test AIDIS connection
./bin/ridge-code.js help    # Show help information
```

## Development

```bash
# Build project
npm run build

# Development mode
npm run dev

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format

# Testing
npm test
```

## Phase 1 MVP Features

- [x] Project structure and base setup
- [x] CLI framework with Commander.js
- [x] TypeScript configuration
- [x] ESLint and Prettier setup
- [ ] `/aidis_store --context` command
- [ ] `/aidis_ping` command enhancement
- [ ] `/help` command enhancement

## Technology Stack

- **Language**: TypeScript
- **CLI Framework**: Commander.js
- **Styling**: Chalk
- **Prompts**: Inquirer
- **HTTP Client**: Axios
- **Build**: TypeScript Compiler
- **Linting**: ESLint + Prettier
- **Testing**: Jest

## License

MIT
