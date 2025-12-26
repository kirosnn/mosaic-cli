import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseDetector } from './baseDetector.js';
import { IDEInstance } from '../types.js';

const execAsync = promisify(exec);

interface PowerShellProcess {
  ProcessName: string;
  ProcessId: number;
  Path: string;
  CommandLine: string;
}

export class WindowsDetector extends BaseDetector {
  getPlatform(): 'windows' {
    return 'windows';
  }

  async detect(): Promise<IDEInstance[]> {
    try {
      const psCommand = `Get-Process | Where-Object {$_.ProcessName -match 'Code|Cursor|Windsurf'} | ForEach-Object { try { $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue; if ($proc) { [PSCustomObject]@{ ProcessName = $_.ProcessName; ProcessId = $_.Id; Path = $_.Path; CommandLine = $proc.CommandLine } } } catch { } } | ConvertTo-Json`;

      const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand}"`, {
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });

      if (stderr) {
        console.error('PowerShell stderr:', stderr);
      }

      if (!stdout || stdout.trim() === '') {
        return [];
      }

      let processes: PowerShellProcess[] = [];

      try {
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
          processes = parsed;
        } else if (parsed && typeof parsed === 'object') {
          processes = [parsed];
        }
      } catch (error) {
        console.error('Failed to parse PowerShell output:', error);
        return [];
      }

      const instances: IDEInstance[] = [];
      const seenProcessIds = new Set<number>();

      for (const proc of processes) {
        if (!proc || !proc.ProcessId || seenProcessIds.has(proc.ProcessId)) {
          continue;
        }

        seenProcessIds.add(proc.ProcessId);

        const type = this.identifyIDEType(proc.ProcessName, proc.Path || '');
        if (type === 'other') {
          continue;
        }

        const workspacePath = this.parseWorkspacePath(proc.CommandLine || '');

        const instance: IDEInstance = {
          type,
          name: this.getIDEName(type),
          processId: proc.ProcessId,
          executablePath: proc.Path || '',
          workspacePath,
          cliCommand: this.getCLICommand(type)
        };

        instances.push(instance);
      }

      return instances;
    } catch (error) {
      console.error('Failed to detect IDEs on Windows:', error);
      return [];
    }
  }
}
