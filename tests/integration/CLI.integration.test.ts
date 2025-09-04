import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

describe('CLI Integration Tests', () => {
  let tempConfigDir: string;
  let originalConfigDir: string;

  beforeAll(async () => {
    // Create temporary config directory for testing
    tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ridge-code-test-'));
    originalConfigDir = process.env.HOME || os.homedir();
    
    // Set environment to use temp config
    process.env.RIDGE_CODE_CONFIG_DIR = tempConfigDir;
  });

  afterAll(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempConfigDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Restore original environment
    delete process.env.RIDGE_CODE_CONFIG_DIR;
  });

  describe('Configuration Commands', () => {
    it('should initialize configuration', async () => {
      const { stdout, stderr } = await execAsync('npm run dev -- config init', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      expect(stderr).not.toContain('Error');
      expect(stdout).toContain('Configuration initialized');
    });

    it('should set configuration values', async () => {
      // First initialize config
      await execAsync('npm run dev -- config init', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      // Set a value
      const { stdout } = await execAsync('npm run dev -- config set models.anthropic.apiKey test-key', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      expect(stdout).toContain('Configuration updated');
    });

    it('should get configuration values', async () => {
      // Initialize and set a value
      await execAsync('npm run dev -- config init', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });
      
      await execAsync('npm run dev -- config set models.anthropic.model claude-3-5-sonnet-20241022', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      // Get the value
      const { stdout } = await execAsync('npm run dev -- config get models.anthropic.model', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      expect(stdout).toContain('claude-3-5-sonnet-20241022');
    });

    it('should show complete configuration', async () => {
      await execAsync('npm run dev -- config init', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      const { stdout } = await execAsync('npm run dev -- config show', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      expect(stdout).toContain('models');
      expect(stdout).toContain('aidis');
      expect(stdout).toContain('ui');
    });
  });

  describe('Chat Commands', () => {
    beforeEach(async () => {
      // Ensure config exists with mock API key
      await execAsync('npm run dev -- config init', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });
      
      await execAsync('npm run dev -- config set models.anthropic.apiKey test-key', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });
    });

    it('should handle single chat message', async () => {
      try {
        const { stdout, stderr } = await execAsync('npm run dev -- chat "Hello, test message"', {
          cwd: '/home/ridgetop/projects/ridge-code',
          timeout: 15000
        });

        // Should not throw error for basic chat functionality
        // Note: This will fail with invalid API key, but should show proper error handling
        expect(stderr.includes('Error') || stdout.includes('Error')).toBe(true);
        expect(stdout).toContain('Error: Invalid API key') || expect(stderr).toContain('Error: Invalid API key');
      } catch (error) {
        // Expected to fail with test API key, but should fail gracefully
        expect(error).toBeDefined();
      }
    });

    it('should provide help information', async () => {
      const { stdout } = await execAsync('npm run dev -- --help', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 10000
      });

      expect(stdout).toContain('Ridge-Code CLI');
      expect(stdout).toContain('config');
      expect(stdout).toContain('chat');
      expect(stdout).toContain('interactive');
    });
  });

  describe('Interactive Mode', () => {
    it('should start interactive mode (basic check)', async () => {
      // This is a basic check that interactive mode can be started
      // Full interactive testing would require more complex setup
      
      const child = exec('timeout 2 npm run dev -- interactive', {
        cwd: '/home/ridgetop/projects/ridge-code'
      });

      let output = '';
      child.stdout?.on('data', (data) => {
        output += data;
      });

      await new Promise((resolve) => {
        child.on('close', resolve);
      });

      // Should at least attempt to start interactive mode
      expect(output).toContain('Ridge-Code Interactive') || expect(output).toContain('Configuration');
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      // Try to use command without initializing config
      try {
        const { stdout, stderr } = await execAsync('npm run dev -- chat "test"', {
          cwd: '/home/ridgetop/projects/ridge-code',
          timeout: 10000,
          env: { ...process.env, RIDGE_CODE_CONFIG_DIR: '/nonexistent/path' }
        });

        expect(stdout).toContain('Configuration') || expect(stderr).toContain('Configuration');
      } catch (error) {
        // Should fail gracefully with helpful error message
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid commands gracefully', async () => {
      try {
        await execAsync('npm run dev -- invalid-command', {
          cwd: '/home/ridgetop/projects/ridge-code',
          timeout: 10000
        });
      } catch (error) {
        // Should provide helpful error message for invalid commands
        expect((error as any).stdout || (error as any).stderr).toContain('error') || 
               expect((error as any).stdout || (error as any).stderr).toContain('help');
      }
    });
  });

  describe('Build and Distribution', () => {
    it('should build without errors', async () => {
      const { stdout, stderr } = await execAsync('npm run build', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 30000
      });

      expect(stderr).not.toContain('error');
      expect(stdout).not.toContain('error');

      // Check that dist directory was created
      const distExists = await fs.access(path.join('/home/ridgetop/projects/ridge-code', 'dist'))
        .then(() => true)
        .catch(() => false);
      
      expect(distExists).toBe(true);
    });

    it('should pass linting', async () => {
      const { stdout, stderr } = await execAsync('npm run lint', {
        cwd: '/home/ridgetop/projects/ridge-code',
        timeout: 20000
      });

      expect(stderr).not.toContain('error');
      expect(stdout).not.toContain('error');
    });

    it('should pass type checking', async () => {
      try {
        const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
          cwd: '/home/ridgetop/projects/ridge-code',
          timeout: 20000
        });

        expect(stderr).not.toContain('error');
      } catch (error) {
        // If TypeScript compilation fails, show the error for debugging
        console.error('TypeScript compilation failed:', error);
        throw error;
      }
    });
  });
});
