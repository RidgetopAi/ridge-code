import { TerminalRenderer } from './src/core/TerminalRenderer';

async function testTerminalRenderer() {
  console.log('Testing TerminalRenderer...');
  
  const renderer = new TerminalRenderer();
  
  // Test markdown rendering
  console.log('\n=== Testing Markdown Rendering ===');
  renderer.renderMarkdown(`# Hello Terminal Renderer

This is a **bold** test with *italic* text and \`inline code\`.

\`\`\`typescript
interface User {
  id: number;
  name: string;
}

const user: User = { id: 1, name: "John" };
console.log(user);
\`\`\`

> This is a blockquote with important information.

- List item 1
- List item 2
- List item 3
`);

  // Test table rendering
  console.log('\n=== Testing Table Rendering ===');
  const tableData = [
    { component: 'Authentication', status: 'Active', details: 'JWT tokens working' },
    { component: 'Database', status: 'Connected', details: 'PostgreSQL ready' },
    { component: 'Cache', status: 'Warning', details: 'Redis connection slow' },
    { component: 'Storage', status: 'Error', details: 'Disk space low' }
  ];
  
  renderer.renderTable(tableData);

  // Test success/warning/error messages
  console.log('\n=== Testing Message Types ===');
  renderer.renderSuccess('Operation completed successfully');
  renderer.renderWarning('This is a warning message');
  renderer.renderInfo('This is an informational message');
  renderer.renderError(new Error('This is a test error with stack trace'));

  // Test streaming response simulation
  console.log('\n=== Testing Streaming Response ===');
  
  async function* createTestStream() {
    const chunks = [
      'Here is a streaming response with ',
      '**markdown** formatting.\n\n',
      'It includes code:\n\n```python\n',
      'def hello_world():\n',
      '    print("Hello, World!")\n',
      '    return "success"\n',
      '```\n\n',
      'And continues with more text after the code block.'
    ];
    
    for (const chunk of chunks) {
      yield chunk;
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  await renderer.renderStreamingResponse(createTestStream());
  
  console.log('\n=== Terminal Renderer Test Complete ===');
}

testTerminalRenderer().catch(console.error);
