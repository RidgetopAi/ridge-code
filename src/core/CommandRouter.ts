import { spawn } from 'child_process';
import { CommandResult, ParsedAidisCommand } from '../types';
import { ResponseBuffer } from '../response/ResponseBuffer';
import { AidisResponseParser } from '../aidis/AidisResponseParser';
import { AidisMcpClient } from '../aidis/AidisMcpClient';

/**
 * CommandRouter handles routing and execution of slash commands and shell passthrough
 */
export class CommandRouter {
  private readonly responseBuffer: ResponseBuffer;
  private readonly aidisParser: AidisResponseParser;
  private readonly aidisClient: AidisMcpClient;
  
  // Dangerous commands that should be blocked for safety
  private readonly BLOCKED_COMMANDS = [
    'rm -rf',
    'sudo rm',
    'mkfs',
    'dd if=',
    'shred',
    'wipefs',
    'fdisk',
    'parted',
    'mkswap',
    'systemctl poweroff',
    'systemctl halt',
    'shutdown',
    'reboot',
    'init 0',
    'init 6',
    'halt',
    'poweroff'
  ];

  constructor(
    responseBuffer: ResponseBuffer,
    aidisClient: AidisMcpClient
  ) {
    this.responseBuffer = responseBuffer;
    this.aidisParser = new AidisResponseParser();
    this.aidisClient = aidisClient;
  }

  /**
   * Route command input to appropriate handler
   */
  routeCommand(input: string): Promise<CommandResult> {
    const trimmedInput = input.trim();
    
    if (trimmedInput.startsWith('/aidis_')) {
      return this.handleAidisCommand(trimmedInput);
    } else if (trimmedInput === '/help') {
      return Promise.resolve(this.handleHelpCommand());
    } else {
      return this.handleShellCommand(trimmedInput);
    }
  }

  /**
   * Handle AIDIS commands
   */
  private async handleAidisCommand(input: string): Promise<CommandResult> {
    try {
      const parts = input.split(' ');
      const command = (parts[0] || '').substring(1); // Remove leading '/'
      const args = parts.slice(1);

      switch (command) {
        case 'aidis_store':
          return await this.handleAidisStore(args);
        case 'aidis_ping':
          return await this.handleAidisPing();
        default:
          return {
            success: false,
            error: `Unknown AIDIS command: ${command}`,
            timestamp: new Date().toISOString(),
            commandType: 'aidis'
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        commandType: 'aidis'
      };
    }
  }

  /**
   * Handle /aidis_store command with --context or --task flags
   */
  private async handleAidisStore(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        error: 'aidis_store requires --context or --task flag',
        timestamp: new Date().toISOString(),
        commandType: 'aidis'
      };
    }

    const flag = args[0];
    
    try {
      // Get recent responses from buffer
      const recentResponses = this.responseBuffer.getRecentResponses(5);
      
      if (recentResponses.length === 0) {
        return {
          success: false,
          error: 'No responses found in buffer to store',
          timestamp: new Date().toISOString(),
          commandType: 'aidis'
        };
      }

      // Parse AIDIS commands from responses
      const parsedCommands: ParsedAidisCommand[] = [];
      
      for (const response of recentResponses) {
        const commands = this.aidisParser.extractCommands(response.content);
        parsedCommands.push(...commands);
      }

      if (parsedCommands.length === 0) {
        return {
          success: false,
          error: 'No AIDIS commands found in recent responses',
          timestamp: new Date().toISOString(),
          commandType: 'aidis'
        };
      }

      let executedCommands = 0;
      const results: string[] = [];

      for (const parsedCommand of parsedCommands) {
        if (flag === '--context' && parsedCommand.command === 'context_store') {
          const result = await this.aidisClient.storeContext(
            parsedCommand.payload.content as string,
            parsedCommand.payload.type as string,
            {
              tags: parsedCommand.payload.tags as string[],
              relevanceScore: parsedCommand.payload.relevanceScore as number,
              sessionId: parsedCommand.payload.sessionId as string,
              metadata: parsedCommand.payload.metadata as Record<string, unknown>
            }
          );
          
          if (result.success) {
            executedCommands++;
            results.push(`Stored context: ${(parsedCommand.payload.content as string).substring(0, 50)}...`);
          } else {
            results.push(`Failed to store context: ${result.error}`);
          }
        } else if (flag === '--task' && parsedCommand.command === 'task_create') {
          const result = await this.aidisClient.createTask(
            (parsedCommand.payload.title as string) || 'Untitled Task',
            {
              description: parsedCommand.payload.description as string,
              type: parsedCommand.payload.type as string,
              priority: parsedCommand.payload.priority as string,
              assignedTo: parsedCommand.payload.assignedTo as string,
              dependencies: parsedCommand.payload.dependencies as string[],
              tags: parsedCommand.payload.tags as string[],
              metadata: parsedCommand.payload.metadata as Record<string, unknown>
            }
          );
          
          if (result.success) {
            executedCommands++;
            results.push(`Created task: ${parsedCommand.payload.title}`);
          } else {
            results.push(`Failed to create task: ${result.error}`);
          }
        }
      }

      if (executedCommands === 0) {
        return {
          success: false,
          error: `No ${flag === '--context' ? 'context_store' : 'task_create'} commands found in recent responses`,
          timestamp: new Date().toISOString(),
          commandType: 'aidis'
        };
      }

      return {
        success: true,
        output: `Executed ${executedCommands} commands:\n${results.join('\n')}`,
        timestamp: new Date().toISOString(),
        commandType: 'aidis'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        commandType: 'aidis'
      };
    }
  }

  /**
   * Handle /aidis_ping command
   */
  private async handleAidisPing(): Promise<CommandResult> {
    try {
      // Ensure client is connected
      if (!this.aidisClient.isConnected()) {
        await this.aidisClient.connect();
      }

      const success = await this.aidisClient.ping();
      
      if (success) {
        return {
          success: true,
          output: 'AIDIS connection successful',
          timestamp: new Date().toISOString(),
          commandType: 'aidis'
        };
      } else {
        return {
          success: false,
          error: 'AIDIS ping failed',
          timestamp: new Date().toISOString(),
          commandType: 'aidis'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        commandType: 'aidis'
      };
    }
  }

  /**
   * Handle /help command
   */
  private handleHelpCommand(): CommandResult {
    const helpText = `
Ridge-Code CLI Commands:

AIDIS Commands:
  /aidis_store --context    Store context from response buffer
  /aidis_store --task       Store task from response buffer  
  /aidis_ping              Test AIDIS connection

System Commands:
  /help                    Show this help message

Shell Passthrough:
  Any command not starting with '/' will be executed as a shell command
  Examples:
    ls -la                 List directory contents
    git status             Check git status
    npm test               Run npm tests
    
Safety Features:
  - Dangerous commands are blocked (rm -rf, sudo rm, etc.)
  - All AIDIS operations use ridge-code project context
  - Response buffer integration for command extraction

Configuration:
  - AIDIS Client: ${this.aidisClient.isConnected() ? 'Connected' : 'Disconnected'}
  - Response Buffer Size: ${this.responseBuffer.size}/${ResponseBuffer.maxSize}
`;

    return {
      success: true,
      output: helpText.trim(),
      timestamp: new Date().toISOString(),
      commandType: 'help'
    };
  }

  /**
   * Handle shell command execution with safety checks
   */
  private async handleShellCommand(command: string): Promise<CommandResult> {
    try {
      // Handle empty command
      if (!command.trim()) {
        return {
          success: false,
          error: 'Empty command provided',
          timestamp: new Date().toISOString(),
          commandType: 'shell'
        };
      }

      // Safety check - block dangerous commands
      for (const blockedCmd of this.BLOCKED_COMMANDS) {
        if (command.toLowerCase().includes(blockedCmd.toLowerCase())) {
          return {
            success: false,
            error: `Command blocked for safety: ${blockedCmd}`,
            timestamp: new Date().toISOString(),
            commandType: 'shell'
          };
        }
      }

      return new Promise<CommandResult>((resolve) => {
        // Use shell: true to execute the entire command as a shell command
        const childProcess = spawn(command.trim(), [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });
        
        let stdout = '';
        let stderr = '';

        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
          });
        }

        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        }

        childProcess.on('close', (code: number | null) => {
          const output = stdout.trim();
          const error = stderr.trim();

          if (code === 0) {
            resolve({
              success: true,
              output: output || 'Command completed successfully',
              timestamp: new Date().toISOString(),
              commandType: 'shell'
            });
          } else {
            resolve({
              success: false,
              error: error || `Command failed with exit code ${code}`,
              output: output || undefined,
              timestamp: new Date().toISOString(),
              commandType: 'shell'
            });
          }
        });

        childProcess.on('error', (error: Error) => {
          resolve({
            success: false,
            error: `Failed to execute command: ${error.message}`,
            timestamp: new Date().toISOString(),
            commandType: 'shell'
          });
        });

        // Set timeout for long-running commands (30 seconds)
        setTimeout(() => {
          if (childProcess.kill) {
            childProcess.kill();
          }
          resolve({
            success: false,
            error: 'Command timed out after 30 seconds',
            timestamp: new Date().toISOString(),
            commandType: 'shell'
          });
        }, 30000);
      });

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        commandType: 'shell'
      };
    }
  }
}
