import { z } from 'zod';
import { ParsedAidisCommand, McpToolCall } from '../types';

/**
 * Validation schemas for AIDIS command payloads
 */
const ContextStoreSchema = z.object({
  content: z.string().min(1),
  type: z.union([
    z.literal('code'),
    z.literal('decision'),
    z.literal('error'),
    z.literal('discussion'),
    z.literal('planning'),
    z.literal('completion'),
    z.literal('milestone'),
  ]),
  tags: z.array(z.string()).optional(),
  relevanceScore: z.number().min(0).max(10).optional(),
  sessionId: z.string().optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const TaskCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z
    .union([
      z.literal('feature'),
      z.literal('bugfix'),
      z.literal('refactor'),
      z.literal('test'),
      z.literal('review'),
      z.literal('documentation'),
      z.literal('general'),
    ])
    .default('general'),
  priority: z
    .union([z.literal('low'), z.literal('medium'), z.literal('high'), z.literal('urgent')])
    .default('medium'),
  assignedTo: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Schema registry for command validation
 */
const COMMAND_SCHEMAS: Record<string, z.ZodSchema> = {
  context_store: ContextStoreSchema,
  task_create: TaskCreateSchema,
};

/**
 * Parser for extracting AIDIS commands from LLM responses
 */
export class AidisResponseParser {
  // Extract pattern: mcp__aidis__(\w+)\s+(\{.*\})
  private readonly AIDIS_PATTERN = /mcp__aidis__(\w+)\s+(\{.*\})/g;

  /**
   * Extract AIDIS commands from response text
   */
  extractCommands(response: string): ParsedAidisCommand[] {
    const commands: ParsedAidisCommand[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    this.AIDIS_PATTERN.lastIndex = 0;

    while ((match = this.AIDIS_PATTERN.exec(response)) !== null) {
      try {
        const [fullMatch, command, jsonPayload] = match;

        if (!command || !jsonPayload) {
          console.warn(`Invalid match structure: ${fullMatch}`);
          continue;
        }

        // Parse JSON payload
        const payload = JSON.parse(jsonPayload);

        // Validate the command and payload
        if (this.validateCommandPayload(command, payload)) {
          commands.push({
            command,
            payload,
          });
        }
      } catch (error) {
        // Log parsing error but continue processing other matches
        console.warn(`Failed to parse AIDIS command: ${match[0]}`, error);
        continue;
      }
    }

    return commands;
  }

  /**
   * Validate command payload against schema
   */
  validateCommandPayload(command: string, payload: object): boolean {
    const schema = COMMAND_SCHEMAS[command];

    if (!schema) {
      console.warn(`Unknown AIDIS command: ${command}`);
      return false;
    }

    try {
      schema.parse(payload);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn(`Invalid payload for command ${command}:`, error.issues);
      }
      return false;
    }
  }

  /**
   * Format parsed command for MCP tool call
   */
  formatForAidis(command: ParsedAidisCommand): McpToolCall {
    return {
      name: `mcp__aidis__${command.command}`,
      arguments: command.payload,
    };
  }

  /**
   * Parse and validate multiple commands from response
   */
  parseResponse(response: string): McpToolCall[] {
    const parsedCommands = this.extractCommands(response);
    return parsedCommands.map(cmd => this.formatForAidis(cmd));
  }

  /**
   * Get supported command types
   */
  getSupportedCommands(): string[] {
    return Object.keys(COMMAND_SCHEMAS);
  }

  /**
   * Validate a single command string (for testing)
   */
  validateCommandString(commandString: string): ParsedAidisCommand | null {
    const match = this.AIDIS_PATTERN.exec(commandString);
    this.AIDIS_PATTERN.lastIndex = 0; // Reset for next use

    if (!match) {
      return null;
    }

    try {
      const [fullMatch, command, jsonPayload] = match;

      if (!command || !jsonPayload) {
        console.warn(`Invalid match structure: ${fullMatch}`);
        return null;
      }

      const payload = JSON.parse(jsonPayload);

      if (this.validateCommandPayload(command, payload)) {
        return { command, payload };
      }
    } catch (error) {
      console.warn(`Failed to validate command string: ${commandString}`, error);
    }

    return null;
  }
}

// Export schemas for testing
export { ContextStoreSchema, TaskCreateSchema, COMMAND_SCHEMAS };
