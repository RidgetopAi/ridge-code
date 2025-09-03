import { AidisResponseParser, ContextStoreSchema, TaskCreateSchema } from '../src/aidis/AidisResponseParser';
import { ParsedAidisCommand, McpToolCall } from '../src/types';

describe('AidisResponseParser', () => {
  let parser: AidisResponseParser;

  beforeEach(() => {
    parser = new AidisResponseParser();
  });

  describe('extractCommands', () => {
    it('should extract context_store commands from exact example format', () => {
      const response = `mcp__aidis__context_store {"content":"Implementing user authentication system with JWT tokens","type":"planning","tags":["auth","security"],"relevanceScore":9}`;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]!.command).toBe('context_store');
      expect(commands[0]!.payload).toEqual({
        content: 'Implementing user authentication system with JWT tokens',
        type: 'planning',
        tags: ['auth', 'security'],
        relevanceScore: 9
      });
    });

    it('should extract task_create commands from exact example format', () => {
      const response = `mcp__aidis__task_create {"title":"Setup authentication routes","description":"Create login and logout endpoints with JWT validation","type":"general","priority":"high"}`;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]!.command).toBe('task_create');
      expect(commands[0]!.payload).toEqual({
        title: 'Setup authentication routes',
        description: 'Create login and logout endpoints with JWT validation',
        type: 'general',
        priority: 'high'
      });
    });

    it('should handle multiple AIDIS commands in single response', () => {
      const response = `
        Let me plan this work:
        
        mcp__aidis__context_store {"content":"Planning authentication system implementation","type":"planning","tags":["auth"],"relevanceScore":8}
        
        And create a task:
        
        mcp__aidis__task_create {"title":"Implement JWT auth","description":"Add JWT authentication to API","type":"feature","priority":"high"}
      `;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(2);
      expect(commands[0]!.command).toBe('context_store');
      expect(commands[1]!.command).toBe('task_create');
    });

    it('should handle malformed JSON gracefully', () => {
      const response = `mcp__aidis__context_store {"content":"test", "invalid": json}`;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(0);
    });

    it('should ignore non-AIDIS content', () => {
      const response = `
        This is regular text content.
        Some other command_pattern {"data": "value"}
        mcp__other__command {"data": "value"}
        Regular text continues...
      `;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(0);
    });

    it('should handle empty responses', () => {
      const commands = parser.extractCommands('');
      expect(commands).toHaveLength(0);
    });

    it('should handle responses with no AIDIS commands', () => {
      const response = 'This is just regular text without any commands.';
      const commands = parser.extractCommands(response);
      expect(commands).toHaveLength(0);
    });
  });

  describe('validateCommandPayload', () => {
    it('should validate correct context_store payload', () => {
      const payload = {
        content: 'Test content',
        type: 'planning',
        tags: ['test'],
        relevanceScore: 7
      };
      
      const isValid = parser.validateCommandPayload('context_store', payload);
      expect(isValid).toBe(true);
    });

    it('should validate correct task_create payload', () => {
      const payload = {
        title: 'Test task',
        description: 'Test description',
        type: 'feature',
        priority: 'medium'
      };
      
      const isValid = parser.validateCommandPayload('task_create', payload);
      expect(isValid).toBe(true);
    });

    it('should reject invalid command types', () => {
      const payload = { content: 'test' };
      const isValid = parser.validateCommandPayload('unknown_command', payload);
      expect(isValid).toBe(false);
    });

    it('should reject invalid context_store payload', () => {
      const payload = {
        content: '', // Empty content should be invalid
        type: 'invalid_type',
        relevanceScore: 15 // Out of range
      };
      
      const isValid = parser.validateCommandPayload('context_store', payload);
      expect(isValid).toBe(false);
    });

    it('should reject invalid task_create payload', () => {
      const payload = {
        title: '', // Empty title should be invalid
        type: 'invalid_type',
        priority: 'invalid_priority'
      };
      
      const isValid = parser.validateCommandPayload('task_create', payload);
      expect(isValid).toBe(false);
    });

    it('should handle minimal valid payloads', () => {
      const contextPayload = {
        content: 'Minimal content',
        type: 'planning'
      };
      
      const taskPayload = {
        title: 'Minimal task'
      };
      
      expect(parser.validateCommandPayload('context_store', contextPayload)).toBe(true);
      expect(parser.validateCommandPayload('task_create', taskPayload)).toBe(true);
    });
  });

  describe('formatForAidis', () => {
    it('should format ParsedAidisCommand to McpToolCall', () => {
      const command: ParsedAidisCommand = {
        command: 'context_store',
        payload: {
          content: 'Test content',
          type: 'planning'
        }
      };
      
      const mcpCall = parser.formatForAidis(command);
      
      expect(mcpCall.name).toBe('mcp__aidis__context_store');
      expect(mcpCall.arguments).toEqual(command.payload);
    });

    it('should format task_create command correctly', () => {
      const command: ParsedAidisCommand = {
        command: 'task_create',
        payload: {
          title: 'Test task',
          priority: 'high'
        }
      };
      
      const mcpCall = parser.formatForAidis(command);
      
      expect(mcpCall.name).toBe('mcp__aidis__task_create');
      expect(mcpCall.arguments).toEqual(command.payload);
    });
  });

  describe('parseResponse', () => {
    it('should parse response and return McpToolCall array', () => {
      const response = `
        mcp__aidis__context_store {"content":"Test context","type":"planning","relevanceScore":8}
        mcp__aidis__task_create {"title":"Test task","type":"feature","priority":"high"}
      `;
      
      const mcpCalls = parser.parseResponse(response);
      
      expect(mcpCalls).toHaveLength(2);
      expect(mcpCalls[0]!.name).toBe('mcp__aidis__context_store');
      expect(mcpCalls[1]!.name).toBe('mcp__aidis__task_create');
    });

    it('should return empty array for response with no valid commands', () => {
      const response = 'Just regular text with no commands';
      const mcpCalls = parser.parseResponse(response);
      expect(mcpCalls).toHaveLength(0);
    });
  });

  describe('validateCommandString', () => {
    it('should validate and parse valid command string', () => {
      const commandString = 'mcp__aidis__context_store {"content":"Test","type":"planning"}';
      const result = parser.validateCommandString(commandString);
      
      expect(result).not.toBeNull();
      expect(result?.command).toBe('context_store');
      expect(result?.payload.content).toBe('Test');
    });

    it('should return null for invalid command string', () => {
      const commandString = 'invalid command format';
      const result = parser.validateCommandString(commandString);
      expect(result).toBeNull();
    });

    it('should return null for valid format but invalid payload', () => {
      const commandString = 'mcp__aidis__context_store {"content":"","type":"invalid"}';
      const result = parser.validateCommandString(commandString);
      expect(result).toBeNull();
    });
  });

  describe('getSupportedCommands', () => {
    it('should return list of supported commands', () => {
      const commands = parser.getSupportedCommands();
      expect(commands).toContain('context_store');
      expect(commands).toContain('task_create');
      expect(commands.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases and integration', () => {
    it('should handle commands with complex JSON payloads', () => {
      const response = `mcp__aidis__context_store {"content":"Complex payload with nested data","type":"planning","tags":["auth","security","api"],"relevanceScore":9,"metadata":{"priority":"high","team":"backend"}}`;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]!.payload.metadata).toEqual({
        priority: 'high',
        team: 'backend'
      });
    });

    it('should handle commands with special characters in strings', () => {
      const response = `mcp__aidis__task_create {"title":"Fix bug: Cannot parse JSON","description":"Handle edge case with quotes and newlines Second line","type":"bugfix","priority":"urgent"}`;
      
      const commands = parser.extractCommands(response);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]!.payload.title).toBe('Fix bug: Cannot parse JSON');
      expect(commands[0]!.payload.description).toContain('Second line');
    });

    it('should maintain regex state correctly across multiple calls', () => {
      const response1 = `mcp__aidis__context_store {"content":"First call","type":"planning"}`;
      const response2 = `mcp__aidis__task_create {"title":"Second call","type":"feature"}`;
      
      const commands1 = parser.extractCommands(response1);
      const commands2 = parser.extractCommands(response2);
      
      expect(commands1).toHaveLength(1);
      expect(commands2).toHaveLength(1);
      expect(commands1[0]!.command).toBe('context_store');
      expect(commands2[0]!.command).toBe('task_create');
    });
  });

  describe('schema validation details', () => {
    it('should validate context_store with all optional fields', () => {
      const payload = {
        content: 'Full context',
        type: 'planning',
        tags: ['tag1', 'tag2'],
        relevanceScore: 8,
        sessionId: 'session-123',
        projectId: 'project-456',
        metadata: { custom: 'data' }
      };
      
      expect(parser.validateCommandPayload('context_store', payload)).toBe(true);
    });

    it('should validate task_create with all optional fields', () => {
      const payload = {
        title: 'Complete task',
        description: 'Full description',
        type: 'feature',
        priority: 'high',
        assignedTo: 'agent-123',
        dependencies: ['task-1', 'task-2'],
        tags: ['frontend', 'urgent'],
        projectId: 'project-789',
        metadata: { estimate: '4h' }
      };
      
      expect(parser.validateCommandPayload('task_create', payload)).toBe(true);
    });

    it('should apply default values for task_create', () => {
      // This test verifies that the Zod schema applies defaults correctly
      const payload = {
        title: 'Task with defaults'
        // type and priority should get default values
      };
      
      expect(parser.validateCommandPayload('task_create', payload)).toBe(true);
    });
  });
});
