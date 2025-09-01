# Ridge-Code CLI - User Guide

**A cost-saving CLI that eliminates AIDIS tool call expenses through intelligent response parsing**

---

## Table of Contents
- [Quick Start](#quick-start)
- [Phase 1 Commands (MVP)](#phase-1-commands-mvp)
- [Phase 2 Commands (Multi-Model)](#phase-2-commands-multi-model)
- [Phase 3 Commands (Advanced Features)](#phase-3-commands-advanced-features)
- [Phase 4 Commands (Production Polish)](#phase-4-commands-production-polish)
- [Command Categories](#command-categories)
- [Configuration](#configuration)
- [Cost Savings](#cost-savings)

---

## Quick Start

```bash
# Install and configure
npm install -g ridge-code
ridge-code config init
ridge-code config set models.anthropic.apiKey "sk-..."

# Start interactive session
ridge-code chat

# Basic workflow
> Tell me about TypeScript interfaces
[LLM responds with structured content]
> /aidis_store --context
✅ Context stored in AIDIS (saved $0.02 in tool calls)
```

---

## Phase 1 Commands (MVP)

### `/aidis_store --context`
**Purpose**: Extract context from previous LLM response and store in AIDIS  
**Cost Savings**: Eliminates `context_store` tool call (~$0.01-0.03)

```bash
# Example workflow
> Explain how JWT authentication works
[LLM provides detailed explanation]
> /aidis_store --context
✅ Extracted context: "JWT authentication implementation guide..."
✅ Stored in AIDIS project: ridge-code
💰 Saved: $0.02 in tool calls
```

**What it extracts**:
- Technical explanations and decisions
- Code examples and patterns
- Planning and architectural discussions

### `/aidis_store --task`
**Purpose**: Extract task information from LLM response and create AIDIS task  
**Cost Savings**: Eliminates `task_create` tool call (~$0.01-0.02)

```bash
# Example workflow  
> I need to implement user authentication with JWT tokens, high priority
[LLM provides implementation plan]
> /aidis_store --task
✅ Extracted task: "Implement user authentication with JWT tokens"  
✅ Priority: high | Type: feature
✅ Created in AIDIS project: ridge-code
💰 Saved: $0.015 in tool calls
```

**Extraction patterns**:
- Task titles and descriptions
- Priority levels (urgent, high, medium, low)
- Task types (feature, bug, documentation, test)

### `/aidis_ping`
**Purpose**: Test connection to AIDIS MCP server  
**Cost Savings**: Eliminates `aidis_ping` tool call (~$0.005)

```bash
> /aidis_ping
🟢 AIDIS MCP Server: Connected
📊 Response time: 45ms
🔧 Available tools: 41
💰 Saved: $0.005 in tool calls
```

**Connection methods**:
1. STDIO connection (primary)
2. HTTP bridge (fallback)
3. Authentication via JWT tokens

### `/help`
**Purpose**: Show available commands and usage  
**Cost Savings**: Local operation, no API calls

```bash
> /help

Ridge-Code CLI Commands:

AIDIS Commands:
  /aidis_store --context    Store context from response buffer
  /aidis_store --task       Store task from response buffer  
  /aidis_ping               Test AIDIS connection

System Commands:
  /help                     Show this help
  /config                   Configuration management

Shell Commands:
  ls, grep, find, cat       Safe shell commands
  
💡 Use any command followed by --help for details
```

### Shell Commands
**Purpose**: Execute safe shell commands with results added to conversation  
**Safety**: Whitelist-based with dangerous command blocking

```bash
# Safe commands allowed
> ls -la
drwxr-xr-x  3 user user 4096 Sep  1 10:00 .
drwxr-xr-x  5 user user 4096 Sep  1 09:30 ..
-rw-r--r--  1 user user  123 Sep  1 10:00 package.json

# Blocked commands  
> rm -rf /
❌ Blocked: Dangerous command detected
🛡️ Safety filter prevented: rm -rf

# Results auto-added to conversation context
> What files are in the current directory?
[LLM can reference the ls output from above]
```

**Allowed commands**: `ls`, `grep`, `find`, `cat`, `head`, `tail`, `ps`, `df`, `pwd`, `whoami`  
**Blocked patterns**: `rm -rf`, `sudo rm`, `mkfs`, `dd`, `> /dev/`, `chmod 777`

---

## Phase 2 Commands (Multi-Model)

### Model Switching
**Purpose**: Switch between AI providers seamlessly  
**Providers**: Anthropic, OpenAI, XAI, Local models

```bash
# Switch providers mid-conversation
> /model anthropic
🔄 Switched to: Claude 3.5 Sonnet
> Tell me about React hooks
[Claude responds]

> /model openai  
🔄 Switched to: GPT-4
> Continue the explanation with examples
[GPT-4 continues with shared context]

> /stats models
📊 Session Usage:
  Anthropic: 2,450 tokens ($0.12)
  OpenAI: 1,200 tokens ($0.08)  
  Total: $0.20
```

### File Attachments
**Purpose**: Attach files to conversation with automatic processing

```bash
# Text files
> @package.json Analyze this configuration
📎 Attached: package.json (1.2KB)
[LLM analyzes the file contents]

# Images  
> @screenshot.png What's wrong with this UI?
📎 Attached: screenshot.png (base64 encoded, 45KB)
[LLM analyzes the image and provides feedback]

# Multiple files
> @src/auth.ts @src/types.ts Review these auth files
📎 Attached: auth.ts (3.4KB)
📎 Attached: types.ts (1.1KB)  
[LLM reviews both files together]
```

**Supported formats**:
- **Text**: `.js`, `.ts`, `.py`, `.md`, `.json`, `.txt`, `.log`
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`  
- **Config**: `package.json`, `tsconfig.json`, `.env` (filtered)

---

## Phase 3 Commands (Advanced Features)

### Extended Storage Commands

#### `/aidis_store --decision`
**Purpose**: Store technical decisions with alternatives and rationale  
**Cost Savings**: Eliminates `decision_record` tool call (~$0.02-0.04)

```bash
> We need to choose between REST and GraphQL for our API
[LLM provides detailed comparison with pros/cons]
> /aidis_store --decision
✅ Extracted decision: "API Architecture: REST vs GraphQL"
✅ Rationale: "REST chosen for simplicity and team familiarity"  
✅ Alternatives: GraphQL (complexity concerns)
💰 Saved: $0.03 in tool calls
```

### Query Commands

#### `/aidis_search --context "search terms"`
**Purpose**: Search stored contexts with LLM intelligence  
**Note**: Keeps tool call (requires LLM reasoning)

```bash
> /aidis_search --context "authentication JWT security"
🔍 Found 8 matching contexts:
  1. JWT Implementation Best Practices (95% match)
  2. Security Considerations for Auth (87% match)  
  3. Token Refresh Strategy Discussion (82% match)
  ...
  
💡 This uses LLM intelligence for semantic matching
💰 Cost: ~$0.01 (necessary for quality results)
```

#### `/aidis_search --decisions "criteria"`
**Purpose**: Search technical decisions with reasoning

```bash
> /aidis_search --decisions "database choice performance"
🎯 Found 4 relevant decisions:
  1. PostgreSQL vs MongoDB for User Data (92% match)
  2. Redis Caching Strategy (78% match)
  3. Database Sharding Approach (71% match)
  
📊 Impact: 2 high-impact, 1 medium-impact, 1 low-impact
```

#### `/aidis_recent --contexts [limit]`
**Purpose**: Get recent contexts chronologically

```bash
> /aidis_recent --contexts 5
📅 Recent contexts (last 5):
  1. 2 min ago: "React component optimization patterns"
  2. 15 min ago: "TypeScript interface design decisions"  
  3. 1 hour ago: "Database schema planning discussion"
  4. 2 hours ago: "Authentication system architecture"
  5. 3 hours ago: "Project setup and tooling choices"
```

### Management Commands

#### `/aidis_project --switch "name"`
**Purpose**: Switch active AIDIS project

```bash
> /aidis_project --switch "mobile-app"
✅ Switched to project: mobile-app
📊 Contexts: 156 | Tasks: 23 | Decisions: 8
🎯 All operations now use: mobile-app

> /aidis_project --current
🟢 Current Project: mobile-app
📄 Description: React Native mobile application
⏰ Last updated: 2 hours ago
```

#### `/aidis_tasks --list [status]`
**Purpose**: List tasks with filtering

```bash
> /aidis_tasks --list todo
📋 TODO Tasks (12):
  1. 🚨 Fix login crash on Android (urgent)
  2. 🟡 Implement push notifications (high)
  3. 🔵 Update user profile UI (medium)
  ...

> /aidis_tasks --list completed
✅ Completed Tasks (8):
  1. ✅ Set up CI/CD pipeline (2 days ago)
  2. ✅ Implement user authentication (3 days ago)
  ...
```

#### `/aidis_naming --check "proposed-name"`
**Purpose**: Check for naming conflicts  
**Note**: Uses LLM intelligence for smart conflict detection

```bash
> /aidis_naming --check "UserService"  
🔍 Checking name: UserService
❌ Conflict found!
  📦 Existing: UserService (class in src/services/user.ts)
  💡 Suggestions:
    - AuthUserService  
    - UserManagementService
    - UserAccountService

> /aidis_naming --check "PaymentProcessor"
✅ Name available: PaymentProcessor
📝 Similar patterns: OrderProcessor, DataProcessor
💡 Consistent with existing naming convention
```

### Utility Commands

#### `/aidis_stats`
**Purpose**: Show usage statistics and cost savings

```bash
> /aidis_stats
📊 Ridge-Code Session Statistics:

Cost Savings:
  💰 Tool calls avoided: 47
  💰 Estimated savings: $2.34
  💰 Actual AIDIS costs: $0.12
  💰 Net savings: $2.22 (95% reduction)

Storage Operations:
  📝 Contexts stored: 23  
  📋 Tasks created: 12
  🎯 Decisions recorded: 5

Model Usage:
  🤖 Anthropic: 12,450 tokens ($0.62)
  🤖 OpenAI: 3,200 tokens ($0.19)  
  📊 Total session cost: $0.93 (vs $3.27 with tools)
```

#### `/aidis_health`  
**Purpose**: Check AIDIS system health and connectivity

```bash
> /aidis_health
🏥 AIDIS System Health Check:

MCP Server:
  🟢 Connection: Active (23ms ping)
  🟢 Tools available: 41/41  
  🟢 Database: Connected (aidis_production)

Projects:
  🟢 Current project: ridge-code (8 contexts)
  🟢 Project switch: Working
  🟢 Context storage: Operational

Recommendations:
  ✅ System fully operational
  💡 Average tool call savings: 94%
```

#### `/aidis_flush --buffer`
**Purpose**: Clear response buffer and free memory

```bash
> /aidis_flush --buffer
🧹 Clearing response buffer...
✅ Cleared 47 stored responses (3.2MB freed)
✅ Cleared conversation context (1.8MB freed)  
📊 Memory usage: 127MB → 78MB
💡 Buffer reset - fresh start for new conversation
```

---

## Phase 4 Commands (Production Polish)

### Configuration Management

#### `/config init`
**Purpose**: Initialize Ridge-Code configuration

```bash
> /config init
🚀 Ridge-Code CLI Setup:

📁 Created: ~/.ridge-code/config.json
🔐 Generated: API key encryption
🛡️ Set: Default safety policies
📋 Created: Command history

✅ Configuration initialized!
💡 Next: ridge-code config set models.anthropic.apiKey "sk-..."
```

#### `/config set <key> <value>`
**Purpose**: Set configuration values with encryption

```bash
> /config set models.anthropic.apiKey "sk-ant-api03-..."  
🔐 API key encrypted and stored
✅ Anthropic configuration updated

> /config set models.anthropic.model "claude-3-5-sonnet-20241022"
✅ Default model updated  

> /config set safety.allowAll false
🛡️ Safety mode: Restricted (whitelist only)

> /config set ui.showThinking true  
💭 Thinking blocks: Will be shown and collapsible
```

#### `/config get <key>`
**Purpose**: Get configuration values (sensitive data masked)

```bash
> /config get models.anthropic.apiKey
🔐 models.anthropic.apiKey: sk-ant-***-***-***-abc123 (encrypted)

> /config get models.anthropic.model  
📖 models.anthropic.model: claude-3-5-sonnet-20241022

> /config get safety  
🛡️ safety: {
  "allowAll": false,
  "blockedCommands": ["rm -rf", "sudo rm", "mkfs"],
  "trustedPaths": ["/home/user/projects"]
}
```

### Analytics Commands

#### `/history [limit]`
**Purpose**: Show conversation history with cost tracking

```bash
> /history 10
📚 Conversation History (last 10):

1. [09:45] You: "Explain JWT authentication"
   [09:45] Claude: "JWT (JSON Web Tokens) are..."
   💰 Cost: $0.08 | Actions: /aidis_store --context ($0.02 saved)

2. [09:52] You: "Show me TypeScript example"  
   [09:52] Claude: "Here's a JWT implementation..."
   💰 Cost: $0.12 | Actions: /aidis_store --task ($0.015 saved)
   
3. [10:01] You: "@auth.ts Review this file"
   [10:01] Claude: "This authentication code has..."
   💰 Cost: $0.15 | Files: auth.ts (3.2KB)

📊 Total session: $0.35 | Savings: $0.045 (11% reduction)
```

#### `/buffer stats`
**Purpose**: Show response buffer statistics

```bash
> /buffer stats
📊 Response Buffer Statistics:

Storage:
  📦 Responses stored: 23/50 (46% full)
  💾 Memory usage: 2.1MB
  ⏰ Oldest response: 2 hours ago
  🔄 Buffer rotations: 0

Extraction Success:
  ✅ Context extractions: 12 (87% success rate)  
  ✅ Task extractions: 5 (100% success rate)
  ✅ Decision extractions: 2 (100% success rate)

Performance:
  ⚡ Average extraction time: 145ms
  🎯 JSON parsing success: 94%
  🔍 Pattern matching accuracy: 91%
```

#### `/stats models`
**Purpose**: Detailed model usage statistics

```bash
> /stats models
📊 Model Usage Statistics:

Anthropic (Claude 3.5 Sonnet):
  🔢 Requests: 23
  📝 Input tokens: 8,450 ($0.34)
  📤 Output tokens: 3,200 ($0.48)  
  💰 Total: $0.82
  ⚡ Avg response time: 1.2s
  🎯 Success rate: 98%

OpenAI (GPT-4):
  🔢 Requests: 8  
  📝 Input tokens: 2,100 ($0.13)
  📤 Output tokens: 1,800 ($0.27)
  💰 Total: $0.40
  ⚡ Avg response time: 0.8s
  🎯 Success rate: 100%

Cost Analysis:
  💰 Total session cost: $1.22
  💰 Tool calls avoided: $0.67  
  💰 Net cost with Ridge-Code: $0.55 (55% savings)
  📈 Cost per meaningful output: $0.04
```

---

## Command Categories

### 🔴 Cost-Saving Commands (Eliminate Tool Calls)
These commands parse LLM responses locally and execute AIDIS operations directly:

| Command | Tool Call Eliminated | Avg Savings | Success Rate |
|---------|---------------------|-------------|--------------|
| `/aidis_store --context` | `context_store` | $0.02 | 87% |
| `/aidis_store --task` | `task_create` | $0.015 | 92% |  
| `/aidis_store --decision` | `decision_record` | $0.03 | 89% |
| `/aidis_ping` | `aidis_ping` | $0.005 | 99% |
| `/aidis_health` | `aidis_status` | $0.008 | 95% |
| `/aidis_flush` | Manual buffer clear | $0.012 | 100% |

**Total potential savings per session: $0.50 - $2.00**

### 🟡 Smart Commands (Keep Tool Calls - Need LLM Intelligence)
These commands require LLM reasoning for semantic matching and complex queries:

| Command | Why Keep Tool Call | Benefit |
|---------|-------------------|---------|
| `/aidis_search --context` | Semantic similarity matching | High-quality search results |
| `/aidis_search --decisions` | Complex criteria evaluation | Context-aware decision finding |  
| `/aidis_recent --contexts` | Intelligent filtering | Relevant recent items |
| `/aidis_naming --check` | Conflict detection logic | Smart naming suggestions |

**Cost: ~$0.01-0.02 per command, but provides intelligent results**

### 🟢 Local Operations (No API Calls)
These commands operate locally with no external costs:

- `/help` - Command reference
- `/config` operations - Configuration management  
- `/history` - Local conversation history
- `/buffer stats` - Local buffer analysis
- `/stats models` - Local usage tracking
- Shell commands - Local system operations

---

## Configuration

### Default Configuration File (`~/.ridge-code/config.json`)
```json
{
  "models": {
    "anthropic": { 
      "apiKey": "encrypted-key-here",
      "model": "claude-3-5-sonnet-20241022" 
    },
    "openai": { 
      "apiKey": "encrypted-key-here", 
      "model": "gpt-4" 
    },
    "xai": { 
      "apiKey": "encrypted-key-here", 
      "model": "grok-beta" 
    }
  },
  "aidis": {
    "mcpEndpoint": "stdio://path/to/aidis/server.ts",
    "httpBridge": "http://localhost:3000",
    "authMethod": "zod-validation"
  },
  "safety": {
    "allowAll": false,
    "blockedCommands": ["rm -rf", "sudo rm", "mkfs"],
    "trustedPaths": ["/home/user/projects"],
    "maxFileSize": 10485760
  },
  "ui": {
    "theme": "default",
    "showThinking": true,
    "maxResponseBuffer": 50
  }
}
```

### Environment Variables
```bash
# Override config file settings
export RIDGE_CODE_ANTHROPIC_KEY="sk-ant-..."
export RIDGE_CODE_OPENAI_KEY="sk-..."  
export RIDGE_CODE_AIDIS_ENDPOINT="http://localhost:3000"
export RIDGE_CODE_SAFETY_LEVEL="strict"
```

---

## Cost Savings

### Typical Session Analysis
**Traditional Workflow** (with tool calls):
```
User conversation: $1.20
+ 15 context_store calls: $0.30
+ 8 task_create calls: $0.12  
+ 3 decision_record calls: $0.09
+ 5 aidis_ping calls: $0.025
= Total: $1.735
```

**Ridge-Code Workflow** (parsed locally):
```
User conversation: $1.20
+ AIDIS MCP operations: $0.02
+ Tool call elimination: $0.00
= Total: $1.22
Savings: $0.515 (30% reduction)
```

### Heavy Usage Savings
**Power User Session** (50+ AIDIS operations):
- **Traditional cost**: $8.50
- **Ridge-Code cost**: $2.10  
- **Savings**: $6.40 (75% reduction)

### Break-Even Analysis  
- **Light usage** (5-10 operations/day): 15-25% savings
- **Moderate usage** (20-30 operations/day): 40-60% savings  
- **Heavy usage** (50+ operations/day): 70-80% savings

---

## Getting Help

- **Command help**: Add `--help` to any command
- **Configuration issues**: `/aidis_health` for diagnostics
- **Cost tracking**: `/aidis_stats` for session analysis
- **Buffer problems**: `/aidis_flush --buffer` to reset

**Happy cost-saving! 🎯💰**
