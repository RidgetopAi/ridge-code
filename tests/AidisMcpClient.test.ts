import { AidisMcpClient, McpClientConfig } from '../src/aidis/AidisMcpClient';

describe('AidisMcpClient Unit Tests', () => {
  let client: AidisMcpClient;
  let mockConfig: McpClientConfig;

  beforeEach(() => {
    mockConfig = {
      command: 'npx',
      args: ['tsx', 'src/server.ts'],
      retryConfig: {
        maxRetries: 1,
        baseDelay: 100,
        maxDelay: 1000,
      },
    };
    
    client = new AidisMcpClient(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(client).toBeInstanceOf(AidisMcpClient);
      expect(client.isConnected()).toBe(false);
    });

    it('should apply default retry config when not provided', () => {
      const minimalConfig = {
        command: 'npx',
        args: ['tsx', 'src/server.ts'],
      };
      
      const clientWithDefaults = new AidisMcpClient(minimalConfig);
      expect(clientWithDefaults).toBeInstanceOf(AidisMcpClient);
    });
  });

  describe('connect', () => {
    it('should establish connection successfully', async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({
          isError: false,
          content: [{ text: 'pong' }],
        }),
      };
      Client.mockImplementation(() => mockClient);

      await client.connect();
      
      expect(client.isConnected()).toBe(true);
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should retry on connection failure', async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn()
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockResolvedValueOnce(undefined),
        callTool: jest.fn().mockResolvedValue({
          isError: false,
          content: [{ text: 'pong' }],
        }),
      };
      Client.mockImplementation(() => mockClient);

      await client.connect();
      
      expect(client.isConnected()).toBe(true);
      expect(mockClient.connect).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockRejectedValue(new Error('Persistent failure')),
      };
      Client.mockImplementation(() => mockClient);

      await expect(client.connect()).rejects.toThrow('Failed to connect after 1 attempts');
    });
  });

  describe('executeCommand', () => {
    let mockClient: any;

    beforeEach(async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({
          isError: false,
          content: [{ text: 'pong' }],
        }),
      };
      Client.mockImplementation(() => mockClient);
      
      await client.connect();
    });

    it('should execute command successfully', async () => {
      mockClient.callTool.mockResolvedValue({
        isError: false,
        content: [{ text: 'success' }],
      });

      const result = await client.executeCommand('context_store', {
        content: 'test content',
        type: 'code',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.timestamp).toBeDefined();
      
      // Verify ridge-code project is automatically included
      expect(mockClient.callTool).toHaveBeenLastCalledWith({
        name: 'mcp__aidis__context_store',
        arguments: {
          content: 'test content',
          type: 'code',
          projectId: 'ridge-code',
        },
      });
    });

    it('should handle command errors gracefully', async () => {
      mockClient.callTool.mockResolvedValue({
        isError: true,
        content: [{ text: 'Command failed' }],
      });

      const result = await client.executeCommand('invalid_command', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error when not connected', async () => {
      const disconnectedClient = new AidisMcpClient(mockConfig);
      
      await expect(
        disconnectedClient.executeCommand('ping', {})
      ).rejects.toThrow('Client not connected. Call connect() first.');
    });
  });

  describe('ping', () => {
    let mockClient: any;

    beforeEach(async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({
          isError: false,
          content: [{ text: 'pong' }],
        }),
      };
      Client.mockImplementation(() => mockClient);
      
      await client.connect();
    });

    it('should return true on successful ping', async () => {
      const result = await client.ping();
      expect(result).toBe(true);
    });

    it('should return false on ping failure', async () => {
      mockClient.callTool.mockResolvedValue({
        isError: true,
        content: [{ text: 'Ping failed' }],
      });

      const result = await client.ping();
      expect(result).toBe(false);
    });
  });

  describe('storeContext', () => {
    let mockClient: any;

    beforeEach(async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn()
          .mockResolvedValueOnce({
            isError: false,
            content: [{ text: 'pong' }],
          })
          .mockResolvedValueOnce({
            isError: false,
            content: [{ text: 'context stored' }],
          }),
      };
      Client.mockImplementation(() => mockClient);
      
      await client.connect();
    });

    it('should store context with ridge-code project', async () => {
      const result = await client.storeContext('test content', 'code', {
        tags: ['test'],
        relevanceScore: 8,
      });

      expect(result.success).toBe(true);
      expect(mockClient.callTool).toHaveBeenLastCalledWith({
        name: 'mcp__aidis__context_store',
        arguments: {
          content: 'test content',
          type: 'code',
          tags: ['test'],
          relevanceScore: 8,
          projectId: 'ridge-code',
        },
      });
    });
  });

  describe('createTask', () => {
    let mockClient: any;

    beforeEach(async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn()
          .mockResolvedValueOnce({
            isError: false,
            content: [{ text: 'pong' }],
          })
          .mockResolvedValueOnce({
            isError: false,
            content: [{ text: 'task created' }],
          }),
      };
      Client.mockImplementation(() => mockClient);
      
      await client.connect();
    });

    it('should create task with ridge-code project', async () => {
      const result = await client.createTask('Test task', {
        description: 'Test description',
        type: 'feature',
        priority: 'high',
      });

      expect(result.success).toBe(true);
      expect(mockClient.callTool).toHaveBeenLastCalledWith({
        name: 'mcp__aidis__task_create',
        arguments: {
          title: 'Test task',
          description: 'Test description',
          type: 'feature',
          priority: 'high',
          projectId: 'ridge-code',
        },
      });
    });
  });

  describe('disconnect', () => {
    it('should close client and transport', async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      const mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({
          isError: false,
          content: [{ text: 'pong' }],
        }),
        close: jest.fn(),
      };
      Client.mockImplementation(() => mockClient);
      
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      client.disconnect();
      
      expect(client.isConnected()).toBe(false);
      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe('getAvailableTools', () => {
    let mockClient: any;

    beforeEach(async () => {
      const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
      mockClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        callTool: jest.fn().mockResolvedValue({
          isError: false,
          content: [{ text: 'pong' }],
        }),
        listTools: jest.fn().mockResolvedValue({
          tools: [
            { name: 'mcp__aidis__context_store' },
            { name: 'mcp__aidis__task_create' },
          ],
        }),
      };
      Client.mockImplementation(() => mockClient);
      
      await client.connect();
    });

    it('should return available tools list', async () => {
      const tools = await client.getAvailableTools();
      
      expect(tools).toEqual([
        'mcp__aidis__context_store',
        'mcp__aidis__task_create',
      ]);
    });
  });
});
