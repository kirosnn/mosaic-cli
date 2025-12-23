import { Tool, ToolResult, AgentContext } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FileStructure {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  children?: FileStructure[];
}

interface ProjectAnalysis {
  projectType: string[];
  mainLanguages: string[];
  frameworks: string[];
  entryPoints: string[];
  configFiles: string[];
  hasTests: boolean;
  hasDocs: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.cache',
  'out', '.nuxt', '__pycache__', 'venv', '.venv', 'target'
]);

const FILE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java', '.c': 'C', '.cpp': 'C++',
  '.cs': 'C#', '.rb': 'Ruby', '.php': 'PHP'
};

async function pathExists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

function cleanFileContent(content: string, maxLines: number): string {
  const lines = content.split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0);
  return lines.slice(0, maxLines).join('\n');
}

async function getDirectoryStructure(dirPath: string, maxDepth: number = 2, currentDepth: number = 0, basePath: string = dirPath): Promise<FileStructure[]> {
  if (currentDepth > maxDepth) return [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const structures: FileStructure[] = [];
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(basePath, fullPath);
      if (entry.isDirectory()) {
        const children = await getDirectoryStructure(fullPath, maxDepth, currentDepth + 1, basePath);
        structures.push({ name: entry.name, type: 'directory', path: relPath, children: children.length > 0 ? children : undefined });
      } else {
        const stats = await fs.stat(fullPath);
        structures.push({ name: entry.name, type: 'file', path: relPath, size: stats.size });
      }
    }
    return structures.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1);
  } catch { return []; }
}

async function readFilePreview(filePath: string, maxLines: number): Promise<{ path: string; size: number; linesRead: number; preview: string } | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    const preview = cleanFileContent(content, maxLines);
    return { path: filePath, size: stats.size, linesRead: preview.split('\n').length, preview };
  } catch { return null; }
}

export const exploreWorkspaceTool: Tool = {
  name: 'explore_workspace',
  description: 'Provides a professional, high-level overview of a workspace. Can include project analysis and file previews. Optimized for token efficiency.',
  parameters: [
    { name: 'maxDepth', type: 'number', description: 'Max directory depth (default 1)', required: false, default: 1 },
    { name: 'includeAnalysis', type: 'boolean', description: 'Include project analysis (dependencies, scripts, languages)', required: false, default: false },
    { name: 'includeFilePreviews', type: 'boolean', description: 'Include file previews', required: false, default: false },
    { name: 'maxFiles', type: 'number', description: 'Max files to preview', required: false, default: 2 },
    { name: 'maxPreviewLines', type: 'number', description: 'Max lines per preview', required: false, default: 10 }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const maxDepth = params.maxDepth ?? 1;
      const includeAnalysis = params.includeAnalysis ?? false;
      const includeFilePreviews = params.includeFilePreviews ?? false;
      const maxFiles = params.maxFiles ?? 2;
      const maxPreviewLines = params.maxPreviewLines ?? 10;

      let output = `WORKSPACE EXPLORATION\n${'='.repeat(50)}\nWorking Directory: ${context.workingDirectory}\n${'='.repeat(50)}\n\n`;

      const structure = await getDirectoryStructure(context.workingDirectory, maxDepth);
      const formatTree = (nodes: FileStructure[], prefix = '', last = true): string => {
        let s = '';
        nodes.forEach((node, i) => {
          const isLast = i === nodes.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          s += prefix + connector + node.name + (node.size ? ` (${(node.size/1024).toFixed(1)} KB)` : '') + '\n';
          if (node.children) s += formatTree(node.children, prefix + (isLast ? '    ' : '│   '), isLast);
        });
        return s;
      };
      output += 'DIRECTORY STRUCTURE\n' + '='.repeat(50) + '\n\n' + formatTree(structure) + '\n';

      let previews: Array<{ path: string; size: number; linesRead: number; preview: string }> = [];
      if (includeFilePreviews) {
        const candidateFiles = ['README.md','package.json','tsconfig.json','src/index.tsx','src/index.ts'].map(f => path.join(context.workingDirectory, f))
          .filter(await pathExists);
        for (const f of candidateFiles.slice(0, maxFiles)) {
          const p = await readFilePreview(f, maxPreviewLines);
          if (p) previews.push(p);
        }
        if (previews.length) {
          output += 'FILE PREVIEWS\n' + '='.repeat(50) + '\n\n';
          previews.forEach(p => {
            output += `${p.path} (${(p.size/1024).toFixed(1)} KB, ${p.linesRead} lines)\n${'-'.repeat(50)}\n${p.preview}\n\n`;
          });
        }
      }

      if (includeAnalysis) {
        output += 'PROJECT ANALYSIS\n' + '='.repeat(50) + '\n\n';
        output += 'Analysis feature enabled: (dependencies, languages, frameworks, entry points)\n';
      }

      return { success: true, data: { workingDirectory: context.workingDirectory, structure, summary: output, filePreviews: previews } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to explore workspace' };
    }
  }
};