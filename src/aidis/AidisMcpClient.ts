import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { McpResponse } from '../types';

export interface McpClientConfig {
  baseUrl?: string; // e.g., "http://localhost:8080"
  command?: string; // Keep for backward compatibility
  args?: string[];
  httpFallback?: {
    url: string;
    token?: string;
  };
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

/**
 * HTTP Client for connecting to AIDIS server via HTTP API
 */
export class AidisMcpClient {
  private httpClient: AxiosInstance;
  private config: McpClientConfig;
  private connected = false;

  constructor(config: McpClientConfig) {
    this.config = {
      baseUrl: 'http://localhost:8080',
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
      },
      ...config,
    };

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Connect to AIDIS server via HTTP API
   */
  async connect(): Promise<void> {
    let retryCount = 0;
    const maxRetries = this.config.retryConfig?.maxRetries ?? 3;
    const baseDelay = this.config.retryConfig?.baseDelay ?? 1000;
    const maxDelay = this.config.retryConfig?.maxDelay ?? 10000;

    while (retryCount <= maxRetries) {
      try {
        await this.attemptHttpConnection();
        this.connected = true;
        console.log('Successfully connected to AIDIS HTTP API');
        return;
      } catch (error) {
        retryCount++;
        console.warn(`HTTP connection attempt ${retryCount} failed:`, error);

        if (retryCount > maxRetries) {
          throw new Error(`Failed to connect after ${maxRetries} attempts: ${error}`);
        }

        // Exponential backoff with jitter
        const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
        const jitter = Math.random() * 0.1 * delay;
        await this.sleep(delay + jitter);
      }
    }
  }

  /**
   * Attempt HTTP connection to AIDIS server
   */
  private async attemptHttpConnection(): Promise<void> {
    // Test the HTTP connection directly without using the public ping method
    try {
      const response: AxiosResponse = await this.httpClient.post(
        '/mcp/tools/aidis_ping',
        {
          arguments: {
            message: 'Ridge-Code HTTP Connection Test',
            projectId: '51040d59-dc3a-4f1b-a17a-cf707cd35937'
          }
        }
      );

      if (!response.data?.success) {
        throw new Error('Ping request failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP connection failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute a command on the AIDIS server via HTTP API
   */
  async executeCommand(command: string, payload: object): Promise<McpResponse> {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      // Ensure ridge-code project context is always included
      const enhancedPayload = {
        ...payload,
        projectId: '51040d59-dc3a-4f1b-a17a-cf707cd35937', // CRITICAL: Always specify ridge-code project UUID
      };

      // Make HTTP request to AIDIS API
      const response: AxiosResponse = await this.httpClient.post(
        `/mcp/tools/${command}`,
        {
          arguments: enhancedPayload,
        }
      );

      const apiResult = response.data;

      if (apiResult.success) {
        return {
          success: true,
          data: apiResult.result,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: apiResult.error || 'Unknown API error',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || error.message;
        return {
          success: false,
          error: `HTTP Error: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test connection with ping command
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.executeCommand('aidis_ping', {
        message: 'Ridge-Code CLI Connection Test',
      });
      return response.success;
    } catch (error) {
      console.warn('Ping failed:', error);
      return false;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.connected = false;
    console.log('Disconnected from AIDIS HTTP API');
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get available tools from the server (HTTP client doesn't need this - tools are predefined)
   */
  async getAvailableTools(): Promise<string[]> {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }

    // Return known AIDIS tool names since HTTP endpoint doesn't provide tool discovery
    return [
      'aidis_ping', 'aidis_status', 'aidis_help', 'aidis_explain', 'aidis_examples',
      'context_store', 'context_search', 'context_get_recent', 'context_stats',
      'project_list', 'project_create', 'project_switch', 'project_current', 'project_info', 'project_insights',
      'naming_register', 'naming_check', 'naming_suggest', 'naming_stats',
      'decision_record', 'decision_search', 'decision_update', 'decision_stats',
      'agent_register', 'agent_list', 'agent_status', 'agent_join', 'agent_leave', 'agent_sessions', 'agent_message', 'agent_messages',
      'task_create', 'task_list', 'task_update',
      'code_analyze', 'code_components', 'code_dependencies', 'code_impact', 'code_stats',
      'smart_search', 'get_recommendations'
    ];
  }

  /**
   * Execute context_store command with ridge-code project context
   */
  async storeContext(content: string, type: string, options?: {
    tags?: string[];
    relevanceScore?: number;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<McpResponse> {
    return this.executeCommand('context_store', {
      content,
      type,
      ...options,
      projectId: '51040d59-dc3a-4f1b-a17a-cf707cd35937', // Explicit ridge-code project context
    });
  }

  /**
   * Execute task_create command with ridge-code project context
   */
  async createTask(title: string, options?: {
    description?: string;
    type?: string;
    priority?: string;
    assignedTo?: string;
    dependencies?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<McpResponse> {
    return this.executeCommand('task_create', {
      title,
      ...options,
      projectId: '51040d59-dc3a-4f1b-a17a-cf707cd35937', // Explicit ridge-code project context
    });
  }



  /**
   * Utility method for sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
