import { exec } from 'child_process';
import { promisify } from 'util';
import { IDEAdapter, IDEInstance, IDEActionResult, IDEType } from '../types.js';

const execAsync = promisify(exec);

export abstract class BaseAdapter implements IDEAdapter {
  abstract readonly type: IDEType;
  abstract readonly cliCommands: string[];
  abstract readonly processNames: string[];

  async openFile(instance: IDEInstance, filePath: string, line?: number): Promise<IDEActionResult> {
    try {
      if (!instance.cliCommand) {
        return {
          success: false,
          error: `No CLI command available for ${instance.name}`
        };
      }

      const fileArg = line ? `${filePath}:${line}` : filePath;
      const command = `${instance.cliCommand} --goto "${fileArg}"`;

      await execAsync(command, { timeout: 5000 });

      return {
        success: true,
        message: `Opened ${filePath}${line ? ` at line ${line}` : ''} in ${instance.name}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async focusWindow(instance: IDEInstance): Promise<IDEActionResult> {
    try {
      if (process.platform === 'win32') {
        const psCommand = `(New-Object -ComObject WScript.Shell).AppActivate(${instance.processId})`;
        await execAsync(`powershell -Command "${psCommand}"`, { timeout: 5000 });

        return {
          success: true,
          message: `Focused ${instance.name} window`
        };
      } else {
        return {
          success: false,
          error: 'Focus window is only supported on Windows'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to focus window: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async getCurrentFile(instance: IDEInstance): Promise<IDEActionResult> {
    return {
      success: false,
      error: 'Get current file is not yet implemented'
    };
  }

  async executeCommand(instance: IDEInstance, command: string): Promise<IDEActionResult> {
    return {
      success: false,
      error: 'Execute command is not yet implemented'
    };
  }

  protected sanitizeFilePath(path: string): string {
    return path.replace(/["']/g, '');
  }
}
