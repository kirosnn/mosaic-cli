import { Tool, ToolResult, AgentContext } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file. Use offset and limit parameters to read only specific lines and reduce token usage.',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to read',
      required: true
    },
    {
      name: 'offset',
      type: 'number',
      description: 'Line number to start reading from (0-based). Default: 0',
      required: false,
      default: 0
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of lines to read. Default: unlimited (reads entire file)',
      required: false
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const filePath = path.resolve(context.workingDirectory, params.path);
      const content = await fs.readFile(filePath, 'utf-8');

      const offset = typeof params.offset === 'number' ? params.offset : 0;
      const limit = typeof params.limit === 'number' ? params.limit : undefined;

      let finalContent = content;
      let totalLines = 0;
      let linesRead = 0;

      if (offset > 0 || limit !== undefined) {
        const lines = String(content || '').split('\n');
        totalLines = lines.length;

        const startIndex = Math.max(0, offset);
        const endIndex = limit !== undefined ? Math.min(startIndex + limit, lines.length) : lines.length;

        const selectedLines = lines.slice(startIndex, endIndex);
        linesRead = selectedLines.length;
        finalContent = selectedLines.join('\n');
      }

      return {
        success: true,
        data: {
          content: finalContent,
          path: filePath,
          ...(offset > 0 || limit !== undefined ? {
            totalLines,
            linesRead,
            offset,
            truncated: limit !== undefined && (offset + limit) < totalLines
          } : {})
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      };
    }
  }
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Create a new file with content. Should only be used for new files, not for modifying existing files.',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the new file to create',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the new file',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!params.path || params.content === undefined) {
        return {
          success: false,
          error: 'Missing required parameters: path and content are required'
        };
      }

      const filePath = path.resolve(context.workingDirectory, params.path);

      try {
        await fs.access(filePath);
        return {
          success: false,
          error: 'File already exists. Use update_file tool to modify existing files.'
        };
      } catch {
        // File doesn't exist, we can proceed
      }

      await fs.writeFile(filePath, params.content, 'utf-8');

      const lines = String(params.content || '').split('\n').length;

      return {
        success: true,
        data: {
          path: filePath,
          bytesWritten: Buffer.byteLength(params.content, 'utf-8'),
          lines: lines
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file'
      };
    }
  }
};

export const updateFileTool: Tool = {
  name: 'update_file',
  description: 'Update specific lines in an existing file. Can modify multiple line ranges at once. IMPORTANT: Line numbers are 1-indexed (first line is 1, not 0). To replace the entire file content, use startLine=1 and endLine=<total lines>.',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to update',
      required: true
    },
    {
      name: 'updates',
      type: 'array',
      description: 'Array of updates to apply. Each update contains startLine (1-indexed), endLine (1-indexed), and newContent. Example: [{startLine: 1, endLine: 1, newContent: "new text"}] replaces the first line.',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const filePath = path.resolve(context.workingDirectory, params.path);

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = String(content || '').split('\n');

      const updates = params.updates as Array<{
        startLine: number;
        endLine: number;
        newContent: string;
      }>;

      updates.sort((a, b) => b.startLine - a.startLine);

      for (const update of updates) {
        if (update.startLine < 1 || update.endLine > lines.length) {
          return {
            success: false,
            error: `Invalid line range: ${update.startLine}-${update.endLine}. File has ${lines.length} lines.`
          };
        }

        const newLines = String(update.newContent || '').split('\n');
        lines.splice(update.startLine - 1, update.endLine - update.startLine + 1, ...newLines);
      }

      const newContent = lines.join('\n');
      await fs.writeFile(filePath, newContent, 'utf-8');

      return {
        success: true,
        data: {
          path: filePath,
          updatesApplied: updates.length,
          totalLines: lines.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update file'
      };
    }
  }
};

export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List contents of a directory',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the directory to list',
      required: false,
      default: '.'
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const dirPath = path.resolve(context.workingDirectory, params.path || '.');
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, entry.name)
      }));

      return {
        success: true,
        data: {
          path: dirPath,
          entries: files
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list directory'
      };
    }
  }
};

export const deleteFileTool: Tool = {
  name: 'delete_file',
  description: 'Delete a file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to delete',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const filePath = path.resolve(context.workingDirectory, params.path);
      await fs.unlink(filePath);

      return {
        success: true,
        data: {
          path: filePath
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  }
};

export const fileExistsTool: Tool = {
  name: 'file_exists',
  description: 'Check if a file or directory exists',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to check',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const filePath = path.resolve(context.workingDirectory, params.path);

      try {
        const stats = await fs.stat(filePath);
        return {
          success: true,
          data: {
            exists: true,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime
          }
        };
      } catch {
        return {
          success: true,
          data: {
            exists: false
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check file existence'
      };
    }
  }
};

export const allFileTools = [
  readFileTool,
  writeFileTool,
  updateFileTool,
  listDirectoryTool,
  deleteFileTool,
  fileExistsTool
];