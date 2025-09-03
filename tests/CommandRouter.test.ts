import { CommandRouter } from '../src/core/CommandRouter';
import { ResponseBuffer } from '../src/response/ResponseBuffer';
import { AidisMcpClient } from '../src/aidis/AidisMcpClient';
import { CommandResult, ResponseMetadata, McpResponse } from '../src/types';

// Mock implementations
class MockAidisMcpClient extends AidisMcpClient {
  private mockConnected = false;
  
  constructor() {
    super({ baseUrl: 'http://localhost:8080' });
  }

  override async connect(): Promise<void> {
    this.mockConnected = true;
    return Promise.resolve();
  }

  override isConnected(): boolean {
    return this.mockConnected;
  }

  override async ping(): Promise<boolean> {
    if (!this.mockConnected) {
      throw new Error('Not connected');
    }
    return this.mockConnected;
  }

  override async storeContext(
    content: string, 
    type: string, 
    options?: any
  ): Promise<McpResponse> {
    return {
      success: true,
      data: { id: 'mock-context-id', content, type },
      timestamp: new Date().toISOString()
    };
  }

  override async createTask(
    title: string, 
    options?: any
  ): Promise<McpResponse> {
    return {
      success: true,
      data: { id: 'mock-task-id', title },
      timestamp: new Date().toISOString()
    };
  }
}

describe('CommandRouter', () => {
  let commandRouter: CommandRouter;
  let responseBuffer: ResponseBuffer;
  let mockAidisClient: MockAidisMcpClient;

  beforeEach(() => {
    responseBuffer = new ResponseBuffer();
    mockAidisClient = new MockAidisMcpClient();
    commandRouter = new CommandRouter(responseBuffer, mockAidisClient);
  });

  describe('routeCommand', () => {
    it('should route AIDIS commands correctly', async () => {
      const result = await commandRouter.routeCommand('/aidis_ping');
      expect(result.commandType).toBe('aidis');
    });

    it('should route help commands correctly', async () => {
      const result = await commandRouter.routeCommand('/help');
      expect(result.commandType).toBe('help');
      expect(result.success).toBe(true);
    });

    it('should route shell commands correctly', async () => {
      const result = await commandRouter.routeCommand('echo test');
      expect(result.commandType).toBe('shell');
    });
  });

  describe('AIDIS commands', () => {
    beforeEach(async () => {
      await mockAidisClient.connect();
    });

    describe('/aidis_ping', () => {
      it('should successfully ping AIDIS when connected', async () => {
        const result = await commandRouter.routeCommand('/aidis_ping');
        
        expect(result.success).toBe(true);
        expect(result.output).toBe('AIDIS connection successful');
        expect(result.commandType).toBe('aidis');
        expect(result.timestamp).toBeDefined();
      });

      it('should handle ping failure gracefully', async () => {
        // Create a client that fails to ping
        class FailingClient extends MockAidisMcpClient {
          override async ping(): Promise<boolean> {
            return false;
          }
        }
        
        const failingClient = new FailingClient();
        await failingClient.connect(); // Connect so isConnected returns true
        const router = new CommandRouter(responseBuffer, failingClient);
        
        const result = await router.routeCommand('/aidis_ping');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('ping failed');
        expect(result.commandType).toBe('aidis');
      });
    });

    describe('/aidis_store', () => {
      it('should require flags', async () => {
        const result = await commandRouter.routeCommand('/aidis_store');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('requires --context or --task flag');
        expect(result.commandType).toBe('aidis');
      });

      it('should handle empty response buffer', async () => {
        const result = await commandRouter.routeCommand('/aidis_store --context');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('No responses found in buffer');
        expect(result.commandType).toBe('aidis');
      });

      it('should process context_store commands from buffer', async () => {
        // Add mock response with AIDIS command to buffer
        const mockResponse = `Here's how to implement authentication:
        
        mcp__aidis__context_store {"content": "Authentication implementation details", "type": "code", "tags": ["auth", "implementation"]}
        
        This should help with your project.`;

        const mockMetadata: ResponseMetadata = {
          model: 'claude-3',
          tokenCount: 150,
          responseTime: 1500
        };

        responseBuffer.addResponse(mockResponse, mockMetadata);

        const result = await commandRouter.routeCommand('/aidis_store --context');
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('Executed 1 commands');
        expect(result.output).toContain('Stored context');
        expect(result.commandType).toBe('aidis');
      });

      it('should process task_create commands from buffer', async () => {
        // Add mock response with task creation command
        const mockResponse = `I'll create a task for this work:
        
        mcp__aidis__task_create {"title": "Implement authentication", "description": "Add user authentication system", "type": "feature", "priority": "high"}
        
        This task will track the implementation progress.`;

        const mockMetadata: ResponseMetadata = {
          model: 'claude-3',
          tokenCount: 120,
          responseTime: 1200
        };

        responseBuffer.addResponse(mockResponse, mockMetadata);

        const result = await commandRouter.routeCommand('/aidis_store --task');
        
        expect(result.success).toBe(true);
        expect(result.output).toContain('Executed 1 commands');
        expect(result.output).toContain('Created task');
        expect(result.commandType).toBe('aidis');
      });

      it('should handle no matching commands in buffer', async () => {
        // Add response without AIDIS commands
        const mockResponse = 'Just a regular response without any AIDIS commands.';
        const mockMetadata: ResponseMetadata = {
          model: 'claude-3',
          tokenCount: 50,
          responseTime: 800
        };

        responseBuffer.addResponse(mockResponse, mockMetadata);

        const result = await commandRouter.routeCommand('/aidis_store --context');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('No AIDIS commands found');
        expect(result.commandType).toBe('aidis');
      });
    });

    describe('Unknown AIDIS commands', () => {
      it('should handle unknown AIDIS commands', async () => {
        const result = await commandRouter.routeCommand('/aidis_unknown');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown AIDIS command');
        expect(result.commandType).toBe('aidis');
      });
    });
  });

  describe('Help command', () => {
    it('should display comprehensive help', async () => {
      const result = await commandRouter.routeCommand('/help');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('Ridge-Code CLI Commands');
      expect(result.output).toContain('/aidis_store --context');
      expect(result.output).toContain('/aidis_store --task');
      expect(result.output).toContain('/aidis_ping');
      expect(result.output).toContain('Shell Passthrough');
      expect(result.output).toContain('Safety Features');
      expect(result.commandType).toBe('help');
    });

    it('should include current configuration status', async () => {
      await mockAidisClient.connect();
      const result = await commandRouter.routeCommand('/help');
      
      expect(result.output).toContain('Connected');
    });
  });

  describe('Shell commands', () => {
    it('should execute safe shell commands', async () => {
      const result = await commandRouter.routeCommand('echo "test"');
      
      expect(result.commandType).toBe('shell');
      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    }, 10000); // Allow more time for shell execution

    it('should block dangerous commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf',
        'mkfs.ext4',
        'dd if=/dev/zero',
        'shred -vfz',
        'systemctl poweroff'
      ];

      for (const cmd of dangerousCommands) {
        const result = await commandRouter.routeCommand(cmd);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Command blocked for safety');
        expect(result.commandType).toBe('shell');
      }
    });

    it('should handle command execution errors', async () => {
      const result = await commandRouter.routeCommand('nonexistent-command-12345');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.commandType).toBe('shell');
    });

    it('should handle commands with exit codes', async () => {
      const result = await commandRouter.routeCommand('ls /nonexistent-directory-12345');
      
      expect(result.success).toBe(false);
      expect(result.commandType).toBe('shell');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed commands gracefully', async () => {
      const result = await commandRouter.routeCommand('/aidis_store --invalid-flag');
      
      expect(result.success).toBe(false);
      expect(result.commandType).toBe('aidis');
    });

    it('should include timestamps in all responses', async () => {
      const helpResult = await commandRouter.routeCommand('/help');
      const pingResult = await commandRouter.routeCommand('/aidis_ping');
      const shellResult = await commandRouter.routeCommand('echo test');
      
      expect(helpResult.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(pingResult.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(shellResult.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('Integration with ResponseBuffer', () => {
    it('should access response buffer statistics', async () => {
      // Add some responses to buffer
      const mockMetadata: ResponseMetadata = {
        model: 'test-model',
        tokenCount: 100,
        responseTime: 1000
      };

      responseBuffer.addResponse('Response 1', mockMetadata);
      responseBuffer.addResponse('Response 2', mockMetadata);

      const result = await commandRouter.routeCommand('/help');
      
      // Help command should show current buffer size
      expect(result.output).toContain('Response Buffer Size: 2');
    });
  });

  describe('Command parsing', () => {
    it('should handle commands with multiple spaces', async () => {
      const result = await commandRouter.routeCommand('   /help   ');
      expect(result.commandType).toBe('help');
      expect(result.success).toBe(true);
    });

    it('should handle empty input', async () => {
      const result = await commandRouter.routeCommand('');
      expect(result.commandType).toBe('shell');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty command provided');
    });
  });
});
