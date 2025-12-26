export type IDEType = 'vscode' | 'cursor' | 'windsurf' | 'other';

export interface IDEInstance {
  type: IDEType;
  name: string;
  processId: number;
  workspacePath?: string;
  executablePath: string;
  cliCommand?: string;
  windowTitle?: string;
}

export interface IDEAction {
  id: string;
  name: string;
  description: string;
  execute: (instance: IDEInstance, params?: any) => Promise<IDEActionResult>;
}

export interface IDEActionResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

export interface IDEDetector {
  detect(): Promise<IDEInstance[]>;
  getPlatform(): 'windows' | 'linux' | 'darwin';
}

export interface IDEAdapter {
  readonly type: IDEType;
  readonly cliCommands: string[];
  readonly processNames: string[];

  openFile(instance: IDEInstance, filePath: string, line?: number): Promise<IDEActionResult>;
  focusWindow(instance: IDEInstance): Promise<IDEActionResult>;
  getCurrentFile(instance: IDEInstance): Promise<IDEActionResult>;
  executeCommand(instance: IDEInstance, command: string): Promise<IDEActionResult>;
}
