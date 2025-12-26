import { IDEDetector, IDEInstance } from '../types.js';

export abstract class BaseDetector implements IDEDetector {
  abstract detect(): Promise<IDEInstance[]>;
  abstract getPlatform(): 'windows' | 'linux' | 'darwin';

  protected parseWorkspacePath(commandLine: string): string | undefined {
    if (!commandLine) return undefined;

    const args = commandLine.split(' ').filter(arg => arg.trim().length > 0);

    for (let i = args.length - 1; i >= 0; i--) {
      const arg = args[i].replace(/['"]/g, '');

      if (arg.startsWith('--') || arg.startsWith('-')) {
        continue;
      }

      if (arg.includes('\\') || arg.includes('/')) {
        if (!arg.endsWith('.exe') && !arg.endsWith('.cmd')) {
          return arg;
        }
      }
    }

    return undefined;
  }

  protected identifyIDEType(processName: string, executablePath: string): 'vscode' | 'cursor' | 'windsurf' | 'other' {
    const lowerName = processName.toLowerCase();
    const lowerPath = executablePath.toLowerCase();

    if (lowerName.includes('code') || lowerPath.includes('vscode') || lowerPath.includes('code.exe')) {
      return 'vscode';
    }
    if (lowerName.includes('cursor') || lowerPath.includes('cursor')) {
      return 'cursor';
    }
    if (lowerName.includes('windsurf') || lowerPath.includes('windsurf')) {
      return 'windsurf';
    }

    return 'other';
  }

  protected getIDEName(type: 'vscode' | 'cursor' | 'windsurf' | 'other'): string {
    switch (type) {
      case 'vscode': return 'Visual Studio Code';
      case 'cursor': return 'Cursor';
      case 'windsurf': return 'Windsurf';
      default: return 'Unknown IDE';
    }
  }

  protected getCLICommand(type: 'vscode' | 'cursor' | 'windsurf' | 'other'): string | undefined {
    switch (type) {
      case 'vscode': return 'code';
      case 'cursor': return 'cursor';
      case 'windsurf': return 'windsurf';
      default: return undefined;
    }
  }
}
