import { Tool, ToolResult, AgentContext } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PathSecurityError } from './pathValidator.js';

const execAsync = promisify(exec);

export const executeShellTool: Tool = {
  name: 'execute_shell',
  description: 'Execute a shell command within the workspace',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'Shell command to execute',
      required: true
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'Working directory for command execution (must be within workspace)',
      required: false
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      let cwd = context.workingDirectory;

      if (params.cwd) {
        if (!context.pathValidator) {
          return {
            success: false,
            error: 'Path validation not available'
          };
        }
        cwd = context.pathValidator.validate(params.cwd);
      }

      const execOptions = {
        cwd,
        env: context.environment,
        maxBuffer: 1024 * 1024 * 10,
        timeout: 120000,
        windowsHide: true
      };

      const { stdout, stderr } = await execAsync(params.command, execOptions);

      return {
        success: true,
        data: {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command: params.command
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Command execution failed',
        data: {
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code
        }
      };
    }
  }
};
