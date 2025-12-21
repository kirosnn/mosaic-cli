import { Tool, ToolResult, AgentContext } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const executeShellTool: Tool = {
  name: 'execute_shell',
  description: 'Execute a shell command',
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
      description: 'Working directory for command execution',
      required: false
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const cwd = params.cwd || context.workingDirectory;

      const { stdout, stderr } = await execAsync(params.command, {
        cwd,
        env: context.environment
      });

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

export const searchCodeTool: Tool = {
  name: 'search_code',
  description: 'Search for a pattern in code files using regex. Automatically ignores common build/dependency directories unless explicitly included. Use regex patterns for flexible searching (e.g., "function\\s+\\w+" to find function declarations).',
  parameters: [
    {
      name: 'pattern',
      type: 'string',
      description: 'Regex pattern to search for. Examples: "console\\.log" for exact match, "import.*from" for imports, "class\\s+\\w+" for class declarations',
      required: true
    },
    {
      name: 'directory',
      type: 'string',
      description: 'Directory to search in (relative to working directory)',
      required: false,
      default: '.'
    },
    {
      name: 'fileExtensions',
      type: 'array',
      description: 'File extensions to search (e.g., [".ts", ".js", ".tsx"]). Leave empty to search all text files',
      required: false,
      default: []
    },
    {
      name: 'includeIgnoredDirs',
      type: 'boolean',
      description: 'Set to true to include normally ignored directories (node_modules, dist, build, etc.)',
      required: false,
      default: false
    },
    {
      name: 'maxResults',
      type: 'number',
      description: 'Maximum number of results to return (default: 100)',
      required: false,
      default: 100
    },
    {
      name: 'caseSensitive',
      type: 'boolean',
      description: 'Whether the search should be case-sensitive (default: true)',
      required: false,
      default: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const searchDir = path.resolve(context.workingDirectory, params.directory || '.');
      const flags = params.caseSensitive !== false ? 'g' : 'gi';
      const pattern = new RegExp(params.pattern, flags);
      const extensions = params.fileExtensions || [];
      const includeIgnored = params.includeIgnoredDirs === true;
      const maxResults = params.maxResults || 100;

      const ignoredDirs = new Set([
        'node_modules',
        'dist',
        'build',
        'out',
        'coverage',
        '.git',
        '.next',
        '.nuxt',
        '.cache',
        'vendor',
        'target',
        'bin',
        'obj',
        '__pycache__',
        '.venv',
        'venv'
      ]);

      const results: Array<{
        file: string;
        directory: string;
        line: number;
        content: string;
        column: number;
      }> = [];

      const filesByDirectory = new Map<string, number>();

      async function searchInDirectory(dir: string): Promise<void> {
        if (results.length >= maxResults) {
          return;
        }

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= maxResults) {
            break;
          }

          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!includeIgnored && (entry.name.startsWith('.') || ignoredDirs.has(entry.name))) {
              continue;
            }
            await searchInDirectory(fullPath);
          } else if (entry.isFile()) {
            if (extensions.length > 0 && !extensions.some((ext: string) => entry.name.endsWith(ext))) {
              continue;
            }

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const safeContent = content || '';
              const lines = safeContent.split('\n');
              const relativePath = path.relative(searchDir, fullPath);
              const directory = path.dirname(relativePath);

              lines.forEach((line, index) => {
                if (results.length >= maxResults) {
                  return;
                }

                const match = pattern.exec(line);
                if (match) {
                  results.push({
                    file: relativePath,
                    directory: directory === '.' ? 'root' : directory,
                    line: index + 1,
                    content: line.trim(),
                    column: match.index + 1
                  });

                  filesByDirectory.set(
                    directory === '.' ? 'root' : directory,
                    (filesByDirectory.get(directory === '.' ? 'root' : directory) || 0) + 1
                  );
                }
              });
            } catch {
            }
          }
        }
      }

      await searchInDirectory(searchDir);

      const directorySummary = Array.from(filesByDirectory.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([dir, count]) => ({ directory: dir, matches: count }));

      return {
        success: true,
        data: {
          pattern: params.pattern,
          caseSensitive: params.caseSensitive !== false,
          searchDirectory: params.directory || '.',
          matches: results,
          count: results.length,
          truncated: results.length >= maxResults,
          directorySummary
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }
};

export const allCodeTools = [
  executeShellTool,
  searchCodeTool
];