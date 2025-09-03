import { TerminalRenderer } from '../src/core/TerminalRenderer';
import chalk from 'chalk';

// Mock console methods for testing
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('TerminalRenderer', () => {
  let renderer: TerminalRenderer;

  beforeEach(() => {
    renderer = new TerminalRenderer();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('renderMarkdown', () => {
    it('should render basic markdown text', () => {
      const markdown = '# Hello World\n\nThis is **bold** and *italic* text.';
      
      renderer.renderMarkdown(markdown);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should render code blocks with syntax highlighting', () => {
      const markdownWithCode = '```javascript\nconst hello = "world";\nconsole.log(hello);\n```';
      
      renderer.renderMarkdown(markdownWithCode);
      
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle malformed markdown gracefully', () => {
      const malformedMarkdown = '# Incomplete markdown [link';
      
      expect(() => renderer.renderMarkdown(malformedMarkdown)).not.toThrow();
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('renderStreamingResponse', () => {
    it('should render streaming text chunks', async () => {
      const chunks = ['Hello ', 'world ', 'from ', 'streaming!'];
      const stream = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      await renderer.renderStreamingResponse(stream);

      expect(mockStdoutWrite).toHaveBeenCalledTimes(chunks.length);
      chunks.forEach(chunk => {
        expect(mockStdoutWrite).toHaveBeenCalledWith(expect.stringContaining(chunk));
      });
    });

    it('should handle code blocks in streaming content', async () => {
      const chunks = ['Here is some code:\n```python\n', 'print("hello")\n', 'print("world")\n', '```\nDone!'];
      const stream = (async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      })();

      await renderer.renderStreamingResponse(stream);

      expect(mockConsoleLog).toHaveBeenCalled(); // Code block rendering
      expect(mockStdoutWrite).toHaveBeenCalled(); // Regular text
    });

    it('should handle streaming errors gracefully', async () => {
      const errorStream = (async function* () {
        yield 'Normal text';
        throw new Error('Stream error');
      })();

      await renderer.renderStreamingResponse(errorStream);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Streaming render error'),
        expect.any(String)
      );
    });
  });

  describe('renderTable', () => {
    it('should render array of objects as formatted table', () => {
      const data = [
        { name: 'John', age: 30, status: 'active' },
        { name: 'Jane', age: 25, status: 'pending' },
        { name: 'Bob', age: 35, status: 'inactive' }
      ];

      renderer.renderTable(data);

      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle empty data array', () => {
      renderer.renderTable([]);

      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.yellow('No data to display'));
    });

    it('should handle null/undefined data', () => {
      renderer.renderTable(null as any);

      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.yellow('No data to display'));
    });

    it('should handle table rendering errors gracefully', () => {
      const problematicData = [{ circular: null }];
      // Create circular reference
      (problematicData[0] as any).circular = problematicData[0];

      expect(() => renderer.renderTable(problematicData)).not.toThrow();
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('renderError', () => {
    it('should render error with message and stack trace', () => {
      const error = new Error('Test error message');
      error.stack = 'Error: Test error message\n    at testFunction (test.js:10:5)\n    at main (test.js:5:3)';

      renderer.renderError(error);

      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.red.bold('✗ ERROR'));
      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.red('Message: Test error message'));
      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.gray('Stack Trace:'));
    });

    it('should handle error without stack trace', () => {
      const error = new Error('Simple error');
      delete (error as any).stack;

      expect(() => renderer.renderError(error)).not.toThrow();
      expect(mockConsoleLog).toHaveBeenCalledWith(chalk.red.bold('✗ ERROR'));
    });
  });

  describe('renderSuccess', () => {
    it('should render success message with green checkmark', () => {
      const message = 'Operation completed successfully';

      renderer.renderSuccess(message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.green.bold('✓') + ' ' + chalk.green(message)
      );
    });
  });

  describe('renderWarning', () => {
    it('should render warning message with yellow warning symbol', () => {
      const message = 'This is a warning message';

      renderer.renderWarning(message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.yellow.bold('⚠') + ' ' + chalk.yellow(message)
      );
    });
  });

  describe('renderInfo', () => {
    it('should render info message with blue info symbol', () => {
      const message = 'This is an informational message';

      renderer.renderInfo(message);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        chalk.blue.bold('ℹ') + ' ' + chalk.blue(message)
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex markdown with mixed content types', () => {
      const complexMarkdown = `
# API Documentation

This is a **comprehensive** guide.

## Code Example

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): User | null {
  return database.find(id);
}
\`\`\`

## Table Data

| Name | Type | Required |
|------|------|----------|
| id   | number | true   |
| name | string | true   |
| email| string | false  |

> **Note**: Always validate input data before processing.

For more info, visit [documentation](https://example.com/docs).
`;

      expect(() => renderer.renderMarkdown(complexMarkdown)).not.toThrow();
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should handle realistic streaming scenario with mixed content', async () => {
      const realStreamChunks = [
        'Let me show you how to implement this feature:\n\n',
        '```typescript\n',
        'export class FeatureHandler {\n',
        '  async handle(request: Request): Promise<Response> {\n',
        '    // Implementation here\n',
        '    return new Response("success");\n',
        '  }\n',
        '}\n',
        '```\n\n',
        'This implementation provides **robust** handling of requests with proper *error* management.'
      ];

      const stream = (async function* () {
        for (const chunk of realStreamChunks) {
          yield chunk;
          // Simulate real streaming delay
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      })();

      await renderer.renderStreamingResponse(stream);

      expect(mockStdoutWrite).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalled(); // Code block
    });

    it('should handle config table rendering scenario', () => {
      const configData = [
        { key: 'api.endpoint', value: 'https://api.example.com', type: 'string' },
        { key: 'auth.enabled', value: true, type: 'boolean' },
        { key: 'timeout.ms', value: 5000, type: 'number' },
        { key: 'debug.mode', value: false, type: 'boolean' }
      ];

      renderer.renderTable(configData);

      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });
});
