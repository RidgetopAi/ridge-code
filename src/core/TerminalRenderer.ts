import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import Table from 'cli-table3';

/**
 * TerminalRenderer - Professional terminal output rendering with markdown support,
 * syntax highlighting, streaming responses, and enhanced formatting
 */
export class TerminalRenderer {
  constructor() {
    // Simple constructor - no complex setup needed
  }

  /**
   * Render markdown content with syntax highlighting and formatting
   */
  renderMarkdown(content: string): void {
    try {
      // Use custom markdown rendering with proper formatting
      const rendered = this.parseMarkdown(content);
      console.log(rendered);
    } catch (error) {
      // Fallback to plain text with basic formatting
      console.log(this.formatPlainText(content));
    }
  }

  /**
   * Custom markdown parser for terminal rendering
   */
  private parseMarkdown(content: string): string {
    let result = content;

    // Handle code blocks first (avoid interfering with other formatting)
    result = result.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
      return '\n' + this.formatCodeBlock(code.trim(), lang || '') + '\n';
    });

    // Handle headings
    result = result.replace(/^### (.*$)/gim, (match, text) => chalk.yellow.bold('### ' + text));
    result = result.replace(/^## (.*$)/gim, (match, text) => chalk.green.bold('## ' + text));
    result = result.replace(/^# (.*$)/gim, (match, text) => chalk.red.bold('# ' + text));

    // Handle inline code
    result = result.replace(/`([^`]+)`/g, (match, code) => chalk.bgGray.white(` ${code} `));

    // Handle bold and italic
    result = result.replace(/\*\*(.*?)\*\*/g, (match, text) => chalk.bold(text));
    result = result.replace(/\*(.*?)\*/g, (match, text) => chalk.italic(text));

    // Handle blockquotes
    result = result.replace(/^> (.*$)/gim, (match, text) => chalk.gray('│ ' + text));

    // Handle lists
    result = result.replace(/^[\s]*[-*+] (.*$)/gim, (match, text) => chalk.cyan('• ') + text);
    result = result.replace(/^[\s]*\d+\. (.*$)/gim, (match, text) => chalk.cyan('1. ') + text);

    // Handle tables (basic)
    if (result.includes('|')) {
      result = this.formatMarkdownTable(result);
    }

    return result;
  }

  /**
   * Render streaming responses with real-time display and markdown parsing
   */
  async renderStreamingResponse(stream: AsyncIterable<string>): Promise<void> {
    let buffer = '';
    let isInCodeBlock = false;
    let codeBlockLanguage = '';
    let codeBlockContent = '';

    try {
      for await (const chunk of stream) {
        buffer += chunk;
        
        // Check for code block delimiters
        const codeBlockMatch = buffer.match(/```(\w+)?\n?([\s\S]*?)```/);
        
        if (codeBlockMatch && !isInCodeBlock) {
          // Found complete code block
          const [fullMatch, language, code] = codeBlockMatch;
          const beforeCode = buffer.substring(0, buffer.indexOf(fullMatch));
          const afterCode = buffer.substring(buffer.indexOf(fullMatch) + fullMatch.length);
          
          // Render content before code block
          if (beforeCode) {
            process.stdout.write(this.formatInlineText(beforeCode));
          }
          
          // Render syntax-highlighted code block
          console.log(this.formatCodeBlock(code || '', language || ''));
          
          // Continue with remaining content
          buffer = afterCode;
        } else if (buffer.includes('```') && !isInCodeBlock) {
          // Start of code block
          const codeBlockStart = buffer.indexOf('```');
          const beforeCode = buffer.substring(0, codeBlockStart);
          const codeBlockHeader = buffer.substring(codeBlockStart);
          const newlineIndex = codeBlockHeader.indexOf('\n');
          
          if (newlineIndex > -1) {
            // We have the complete header
            codeBlockLanguage = codeBlockHeader.substring(3, newlineIndex).trim();
            isInCodeBlock = true;
            codeBlockContent = '';
            
            // Render content before code block
            if (beforeCode) {
              process.stdout.write(this.formatInlineText(beforeCode));
            }
            
            buffer = codeBlockHeader.substring(newlineIndex + 1);
          }
        } else if (isInCodeBlock && buffer.includes('```')) {
          // End of code block
          const endIndex = buffer.indexOf('```');
          codeBlockContent += buffer.substring(0, endIndex);
          
          // Render complete code block
          console.log(this.formatCodeBlock(codeBlockContent, codeBlockLanguage));
          
          // Reset state and continue
          isInCodeBlock = false;
          buffer = buffer.substring(endIndex + 3);
          codeBlockLanguage = '';
          codeBlockContent = '';
        } else if (isInCodeBlock) {
          // Accumulate code block content
          codeBlockContent += chunk;
        } else {
          // Regular streaming text
          process.stdout.write(this.formatInlineText(chunk));
        }
      }
      
      // Handle any remaining buffer content
      if (buffer) {
        if (isInCodeBlock) {
          // Incomplete code block, render as code
          console.log(this.formatCodeBlock(codeBlockContent + buffer, codeBlockLanguage));
        } else {
          process.stdout.write(this.formatInlineText(buffer));
        }
      }
      
    } catch (error) {
      // Fallback: just write chunks directly
      console.error(chalk.yellow('⚠ Streaming render error, falling back to plain output'));
      for await (const chunk of stream) {
        process.stdout.write(chunk);
      }
    }
  }

  /**
   * Render data as a formatted table
   */
  renderTable(data: object[]): void {
    if (!data || data.length === 0) {
      console.log(chalk.yellow('No data to display'));
      return;
    }

    try {
      // Extract headers from first object
      const firstItem = data[0];
      if (!firstItem) {
        console.log(chalk.yellow('No data to display'));
        return;
      }
      
      const headers = Object.keys(firstItem);
      
      // Create table with styling
      const table = new Table({
        head: headers.map(h => chalk.bold.cyan(h)),
        style: {
          head: [],
          border: ['gray']
        },
        colWidths: headers.map(() => null) // Auto-width
      });

      // Add rows
      data.forEach(row => {
        const values = headers.map(header => {
          const value = (row as any)[header];
          return this.formatTableCell(value);
        });
        table.push(values);
      });

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red('✗ Table rendering error:'), error);
      // Fallback to simple JSON display
      console.log(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Render error with proper formatting and color coding
   */
  renderError(error: Error): void {
    console.log(chalk.red.bold('✗ ERROR'));
    console.log(chalk.red(`Message: ${error.message}`));
    
    if (error.stack) {
      console.log(chalk.gray('Stack Trace:'));
      const stackLines = error.stack.split('\n');
      stackLines.forEach((line, index) => {
        if (index === 0) {
          // Error message line
          console.log(chalk.red(`  ${line}`));
        } else if (line.includes('at ')) {
          // Stack frame
          const match = line.match(/at\s+(.+)\s+\((.+)\)/);
          if (match) {
            const [, func, location] = match;
            console.log(chalk.gray(`  at `) + chalk.yellow(func) + chalk.gray(` (${location})`));
          } else {
            console.log(chalk.gray(`  ${line}`));
          }
        } else {
          console.log(chalk.gray(`  ${line}`));
        }
      });
    }
    
    console.log(); // Empty line after error
  }

  /**
   * Render success message with proper formatting
   */
  renderSuccess(message: string): void {
    console.log(chalk.green.bold('✓') + ' ' + chalk.green(message));
  }

  /**
   * Render warning message with proper formatting
   */
  renderWarning(message: string): void {
    console.log(chalk.yellow.bold('⚠') + ' ' + chalk.yellow(message));
  }

  /**
   * Render info message with proper formatting
   */
  renderInfo(message: string): void {
    console.log(chalk.blue.bold('ℹ') + ' ' + chalk.blue(message));
  }

  /**
   * Format code block with syntax highlighting
   */
  private formatCodeBlock(code: string, language: string): string {
    try {
      const highlighted = highlight(code, { 
        language: language || 'text',
        theme: 'github-dark'
      });
      return chalk.gray('```' + language) + '\n' + highlighted + '\n' + chalk.gray('```');
    } catch (error) {
      // Fallback to plain code block
      return chalk.gray('```' + language) + '\n' + chalk.white(code) + '\n' + chalk.gray('```');
    }
  }

  /**
   * Format plain text with basic markdown-like formatting
   */
  private formatPlainText(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      .replace(/\*(.*?)\*/g, chalk.italic('$1'))
      .replace(/`(.*?)`/g, chalk.bgGray.white(' $1 '))
      .replace(/^### (.*$)/gim, chalk.yellow.bold('### $1'))
      .replace(/^## (.*$)/gim, chalk.green.bold('## $1'))
      .replace(/^# (.*$)/gim, chalk.red.bold('# $1'));
  }

  /**
   * Format inline text with basic styling for streaming
   */
  private formatInlineText(text: string): string {
    // Basic inline formatting for streaming
    return text
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      .replace(/\*(.*?)\*/g, chalk.italic('$1'))
      .replace(/`(.*?)`/g, chalk.bgGray.white(' $1 '));
  }

  /**
   * Format markdown tables for terminal display
   */
  private formatMarkdownTable(content: string): string {
    const lines = content.split('\n');
    const tableLines = lines.filter(line => line.includes('|'));
    
    if (tableLines.length < 2) {
      return content; // Not a proper table
    }

    try {
      // Parse header row
      const headerTableLine = tableLines[0];
      if (!headerTableLine) {
        return content;
      }
      
      const headerRow = headerTableLine.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      // Parse data rows (skip separator row)
      const dataRows = tableLines.slice(2).map(line => 
        line.split('|').map(cell => cell.trim()).filter(cell => cell)
      );

      if (headerRow.length === 0) {
        return content;
      }

      // Create formatted table
      const table = new Table({
        head: headerRow.map(h => chalk.bold.cyan(h)),
        style: {
          head: [],
          border: ['gray']
        }
      });

      dataRows.forEach(row => {
        if (row.length > 0) {
          table.push(row.map(cell => this.formatTableCell(cell)));
        }
      });

      // Replace the table portion with formatted version
      const firstTableLine = tableLines[0];
      const lastTableLine = tableLines[tableLines.length - 1];
      
      if (!firstTableLine || !lastTableLine) {
        return content;
      }
      
      const firstTableLineIndex = lines.findIndex(line => line === firstTableLine);
      const lastTableLineIndex = lines.findIndex(line => line === lastTableLine);
      
      if (firstTableLineIndex !== -1 && lastTableLineIndex !== -1) {
        const beforeTable = lines.slice(0, firstTableLineIndex);
        const afterTable = lines.slice(lastTableLineIndex + 1);
        
        return [...beforeTable, table.toString(), ...afterTable].join('\n');
      }
      
      return content; // Fallback
    } catch (error) {
      return content; // Fallback to original
    }
  }

  /**
   * Format table cell values with appropriate styling
   */
  private formatTableCell(value: any): string {
    if (value === null || value === undefined) {
      return chalk.gray('(null)');
    }
    
    if (typeof value === 'boolean') {
      return value ? chalk.green('true') : chalk.red('false');
    }
    
    if (typeof value === 'number') {
      return chalk.cyan(value.toString());
    }
    
    if (typeof value === 'string') {
      // Check for special values
      if (value.toLowerCase() === 'error' || value.toLowerCase() === 'failed') {
        return chalk.red(value);
      }
      if (value.toLowerCase() === 'success' || value.toLowerCase() === 'ok') {
        return chalk.green(value);
      }
      if (value.toLowerCase() === 'warning' || value.toLowerCase() === 'pending') {
        return chalk.yellow(value);
      }
      return value;
    }
    
    return chalk.gray(JSON.stringify(value));
  }
}
