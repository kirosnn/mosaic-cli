import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, statSync, readdirSync } from 'fs';

export interface FileReference {
  path: string;
  content: string;
  isDirectory: boolean;
}

export function extractFileReferences(input: string): string[] {
  const references: string[] = [];
  const regex = /#([^\s#]+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    references.push(match[1]);
  }

  return references;
}

export function removeFileReferences(input: string): string {
  return input.replace(/#([^\s#]+)/g, '').trim();
}

async function readDirectory(dirPath: string, maxDepth: number = 2, currentDepth: number = 0): Promise<string> {
  if (currentDepth >= maxDepth) {
    return `[Directory: ${dirPath}] (max depth reached)`;
  }

  let content = '';
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }

      if (entry.isDirectory()) {
        content += `\n## Directory: ${fullPath}\n`;
        content += await readDirectory(fullPath, maxDepth, currentDepth + 1);
      } else if (entry.isFile()) {
        try {
          const fileContent = await fs.readFile(fullPath, 'utf-8');
          const ext = path.extname(entry.name);
          content += `\n### File: ${fullPath}\n\`\`\`${ext.slice(1) || 'txt'}\n${fileContent}\n\`\`\`\n`;
        } catch {
          content += `\n### File: ${fullPath}\n[Unable to read file]\n`;
        }
      }
    }
  } catch (error) {
    content = `[Error reading directory: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }

  return content;
}

export async function resolveFileReferences(
  references: string[],
  workingDirectory: string
): Promise<FileReference[]> {
  const resolved: FileReference[] = [];

  for (const ref of references) {
    const absolutePath = path.isAbsolute(ref)
      ? ref
      : path.resolve(workingDirectory, ref);

    if (!existsSync(absolutePath)) {
      resolved.push({
        path: ref,
        content: `[File or directory not found: ${ref}]`,
        isDirectory: false
      });
      continue;
    }

    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      const dirContent = await readDirectory(absolutePath);
      resolved.push({
        path: ref,
        content: dirContent,
        isDirectory: true
      });
    } else {
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const ext = path.extname(ref);
        const formattedContent = `\`\`\`${ext.slice(1) || 'txt'}\n${content}\n\`\`\``;
        resolved.push({
          path: ref,
          content: formattedContent,
          isDirectory: false
        });
      } catch (error) {
        resolved.push({
          path: ref,
          content: `[Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          isDirectory: false
        });
      }
    }
  }

  return resolved;
}

export function formatReferencesForContext(references: FileReference[]): string {
  if (references.length === 0) return '';

  let formatted = '\n\n## Context Files\n\nThe user has provided the following files/directories for context:\n';

  for (const ref of references) {
    formatted += `\n### ${ref.isDirectory ? 'Directory' : 'File'}: ${ref.path}\n`;
    formatted += ref.content + '\n';
  }

  return formatted;
}
