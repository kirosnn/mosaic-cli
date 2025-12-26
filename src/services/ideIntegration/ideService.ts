import { IDEInstance, IDEActionResult, IDEDetector, IDEAdapter, IDEType } from './types.js';
import { WindowsDetector } from './detectors/windowsDetector.js';
import { VSCodeAdapter } from './adapters/vscodeAdapter.js';
import { CursorAdapter } from './adapters/cursorAdapter.js';
import { WindsurfAdapter } from './adapters/windsurfAdapter.js';

class IDEService {
  private detectedIDEs: IDEInstance[] = [];
  private selectedIDE: IDEInstance | null = null;
  private detector: IDEDetector;
  private adapters: Map<IDEType, IDEAdapter>;
  private lastDetection: number = 0;
  private detectionCacheMs: number = 5000;

  constructor() {
    if (process.platform === 'win32') {
      this.detector = new WindowsDetector();
    } else {
      throw new Error('Only Windows is currently supported for IDE detection');
    }

    this.adapters = new Map();
    this.adapters.set('vscode', new VSCodeAdapter());
    this.adapters.set('cursor', new CursorAdapter());
    this.adapters.set('windsurf', new WindsurfAdapter());
  }

  async detectIDEs(forceRefresh = false): Promise<IDEInstance[]> {
    const now = Date.now();
    if (!forceRefresh && now - this.lastDetection < this.detectionCacheMs) {
      return this.detectedIDEs;
    }

    try {
      this.detectedIDEs = await this.detector.detect();
      this.lastDetection = now;

      if (this.selectedIDE) {
        const stillRunning = this.detectedIDEs.find(
          ide => ide.processId === this.selectedIDE!.processId
        );
        if (!stillRunning) {
          this.selectedIDE = null;
        }
      }

      return this.detectedIDEs;
    } catch (error) {
      console.error('Failed to detect IDEs:', error);
      return [];
    }
  }

  selectIDE(instance: IDEInstance): void {
    this.selectedIDE = instance;
  }

  getSelectedIDE(): IDEInstance | null {
    return this.selectedIDE;
  }

  getDetectedIDEs(): IDEInstance[] {
    return this.detectedIDEs;
  }

  async openFile(filePath: string, line?: number): Promise<IDEActionResult> {
    if (!this.selectedIDE) {
      return {
        success: false,
        error: 'No IDE selected. Use /ide command first.'
      };
    }

    const adapter = this.adapters.get(this.selectedIDE.type);
    if (!adapter) {
      return {
        success: false,
        error: `No adapter found for ${this.selectedIDE.type}`
      };
    }

    return adapter.openFile(this.selectedIDE, filePath, line);
  }

  async focusWindow(): Promise<IDEActionResult> {
    if (!this.selectedIDE) {
      return {
        success: false,
        error: 'No IDE selected. Use /ide command first.'
      };
    }

    const adapter = this.adapters.get(this.selectedIDE.type);
    if (!adapter) {
      return {
        success: false,
        error: `No adapter found for ${this.selectedIDE.type}`
      };
    }

    return adapter.focusWindow(this.selectedIDE);
  }

  async executeAction(actionId: string, params?: any): Promise<IDEActionResult> {
    if (!this.selectedIDE) {
      return {
        success: false,
        error: 'No IDE selected. Use /ide command first.'
      };
    }

    const adapter = this.adapters.get(this.selectedIDE.type);
    if (!adapter) {
      return {
        success: false,
        error: `No adapter found for ${this.selectedIDE.type}`
      };
    }

    switch (actionId) {
      case 'open_file':
        return adapter.openFile(this.selectedIDE, params.path, params.line);
      case 'focus_window':
        return adapter.focusWindow(this.selectedIDE);
      case 'get_current_file':
        return adapter.getCurrentFile(this.selectedIDE);
      case 'execute_command':
        return adapter.executeCommand(this.selectedIDE, params.command);
      default:
        return {
          success: false,
          error: `Unknown action: ${actionId}`
        };
    }
  }

  clearSelection(): void {
    this.selectedIDE = null;
  }

  setDetectionCacheMs(ms: number): void {
    this.detectionCacheMs = ms;
  }
}

export const ideService = new IDEService();
