import { Tool, ToolResult, AgentContext } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FileStructure {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileStructure[];
  size?: number;
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
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  'out',
  '.nuxt',
  '__pycache__',
  'venv',
  '.venv',
  'target'
]);

const PROJECT_TYPE_INDICATORS: Record<string, string[]> = {
  'React': ['react', '@types/react', 'react-dom'],
  'Next.js': ['next'],
  'Vue': ['vue', '@vue/cli'],
  'Angular': ['@angular/core'],
  'Node.js': ['express', 'koa', 'fastify', 'nest'],
  'TypeScript': ['typescript', '@types/node'],
  'Python': ['requirements.txt', 'setup.py', 'pyproject.toml'],
  'Rust': ['Cargo.toml'],
  'Go': ['go.mod'],
  'Java': ['pom.xml', 'build.gradle']
};

const FILE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP'
};

async function getDirectoryStructure(
  dirPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
  relativeTo: string = dirPath
): Promise<FileStructure[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const structures: FileStructure[] = [];

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        const children = await getDirectoryStructure(
          fullPath,
          maxDepth,
          currentDepth + 1,
          relativeTo
        );
        structures.push({
          name: entry.name,
          type: 'directory',
          path: relativePath,
          children: children.length > 0 ? children : undefined
        });
      } else {
        const stats = await fs.stat(fullPath);
        structures.push({
          name: entry.name,
          type: 'file',
          path: relativePath,
          size: stats.size
        });
      }
    }

    return structures.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    return [];
  }
}

async function analyzeProject(workingDir: string): Promise<ProjectAnalysis> {
  const analysis: ProjectAnalysis = {
    projectType: [],
    mainLanguages: [],
    frameworks: [],
    entryPoints: [],
    configFiles: [],
    hasTests: false,
    hasDocs: false
  };

  try {
    const entries = await fs.readdir(workingDir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const file of files) {
      if (file === 'package.json') {
        analysis.configFiles.push(file);
        try {
          const content = await fs.readFile(path.join(workingDir, file), 'utf-8');
          const pkg = JSON.parse(content);

          analysis.dependencies = pkg.dependencies || {};
          analysis.devDependencies = pkg.devDependencies || {};
          analysis.scripts = pkg.scripts || {};

          const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies
          };

          for (const [type, indicators] of Object.entries(PROJECT_TYPE_INDICATORS)) {
            if (indicators.some(ind => ind in allDeps || files.includes(ind))) {
              if (!analysis.projectType.includes(type)) {
                analysis.projectType.push(type);
              }
            }
          }

          if (pkg.main) analysis.entryPoints.push(pkg.main);
          if (pkg.module) analysis.entryPoints.push(pkg.module);
          if (pkg.types) analysis.entryPoints.push(pkg.types);
        } catch {}
      } else if (['tsconfig.json', 'jsconfig.json', '.eslintrc', '.prettierrc'].includes(file)) {
        analysis.configFiles.push(file);
      } else if (file === 'README.md' || file.startsWith('README')) {
        analysis.hasDocs = true;
      } else if (file === 'Cargo.toml') {
        analysis.projectType.push('Rust');
        analysis.configFiles.push(file);
      } else if (file === 'go.mod') {
        analysis.projectType.push('Go');
        analysis.configFiles.push(file);
      } else if (file === 'requirements.txt' || file === 'pyproject.toml') {
        analysis.projectType.push('Python');
        analysis.configFiles.push(file);
      }
    }

    for (const dir of dirs) {
      if (dir === 'test' || dir === 'tests' || dir === '__tests__' || dir === 'spec') {
        analysis.hasTests = true;
      }
      if (dir === 'docs' || dir === 'documentation') {
        analysis.hasDocs = true;
      }
    }

    const languageCount: Record<string, number> = {};
    const scanDirectory = async (dirPath: string, depth: number = 0) => {
      if (depth > 3) return;

      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;

          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            await scanDirectory(fullPath, depth + 1);
          } else {
            const ext = path.extname(entry.name);
            if (FILE_EXTENSIONS[ext]) {
              const lang = FILE_EXTENSIONS[ext];
              languageCount[lang] = (languageCount[lang] || 0) + 1;
            }
          }
        }
      } catch {}
    };

    await scanDirectory(workingDir);

    analysis.mainLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);

  } catch (error) {
    console.error('Error analyzing project:', error);
  }

  return analysis;
}

function formatProjectAnalysis(analysis: ProjectAnalysis): string {
  let output = 'PROJECT ANALYSIS\n';
  output += '='.repeat(50) + '\n\n';

  if (analysis.projectType.length > 0) {
    output += `Project Type: ${analysis.projectType.join(', ')}\n`;
  }

  if (analysis.mainLanguages.length > 0) {
    output += `Main Languages: ${analysis.mainLanguages.join(', ')}\n`;
  }

  if (analysis.entryPoints.length > 0) {
    output += `Entry Points: ${analysis.entryPoints.join(', ')}\n`;
  }

  output += `Tests: ${analysis.hasTests ? 'Yes' : 'No'}\n`;
  output += `Documentation: ${analysis.hasDocs ? 'Yes' : 'No'}\n`;

  if (analysis.configFiles.length > 0) {
    output += `\nConfig Files:\n`;
    analysis.configFiles.forEach(file => {
      output += `  - ${file}\n`;
    });
  }

  if (analysis.scripts && Object.keys(analysis.scripts).length > 0) {
    output += `\nAvailable Scripts:\n`;
    Object.entries(analysis.scripts).forEach(([name, cmd]) => {
      output += `  - ${name}: ${cmd}\n`;
    });
  }

  if (analysis.dependencies && Object.keys(analysis.dependencies).length > 0) {
    output += `\nMain Dependencies (${Object.keys(analysis.dependencies).length}):\n`;
    Object.entries(analysis.dependencies).slice(0, 10).forEach(([name, version]) => {
      output += `  - ${name}@${version}\n`;
    });
    if (Object.keys(analysis.dependencies).length > 10) {
      output += `  ... and ${Object.keys(analysis.dependencies).length - 10} more\n`;
    }
  }

  return output;
}

function formatDirectoryTree(structures: FileStructure[], prefix: string = '', isLast: boolean = true): string {
  let output = '';

  structures.forEach((structure, index) => {
    const isLastItem = index === structures.length - 1;
    const connector = isLastItem ? '└── ' : '├── ';
    const extension = isLastItem ? '    ' : '│   ';

    output += prefix + connector + structure.name;

    if (structure.type === 'file' && structure.size !== undefined) {
      const sizeKB = (structure.size / 1024).toFixed(1);
      output += ` (${sizeKB} KB)`;
    }

    output += '\n';

    if (structure.children && structure.children.length > 0) {
      output += formatDirectoryTree(structure.children, prefix + extension, isLastItem);
    }
  });

  return output;
}

export const exploreWorkspaceTool: Tool = {
  name: 'explore_workspace',
  description: 'Explore and analyze the workspace structure. Provides a comprehensive overview of the project including file structure, project type, languages, dependencies, and configuration. This is the ideal tool to understand a new codebase or workspace.',
  parameters: [
    {
      name: 'maxDepth',
      type: 'number',
      description: 'Maximum depth to explore directories (default: 3)',
      required: false,
      default: 3
    },
    {
      name: 'includeAnalysis',
      type: 'boolean',
      description: 'Include detailed project analysis (default: true)',
      required: false,
      default: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const maxDepth = params.maxDepth || 3;
      const includeAnalysis = params.includeAnalysis !== false;

      let output = '';

      output += `WORKSPACE EXPLORATION\n`;
      output += `${'='.repeat(50)}\n`;
      output += `Working Directory: ${context.workingDirectory}\n`;
      output += `${'='.repeat(50)}\n\n`;

      if (includeAnalysis) {
        const analysis = await analyzeProject(context.workingDirectory);
        output += formatProjectAnalysis(analysis);
        output += '\n';
      }

      output += 'DIRECTORY STRUCTURE\n';
      output += '='.repeat(50) + '\n\n';

      const structure = await getDirectoryStructure(
        context.workingDirectory,
        maxDepth
      );

      output += formatDirectoryTree(structure);

      return {
        success: true,
        data: {
          workingDirectory: context.workingDirectory,
          structure,
          summary: output
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to explore workspace'
      };
    }
  }
};

export const allExplorerTools = [
  exploreWorkspaceTool
];
