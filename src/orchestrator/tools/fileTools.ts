import { Tool, ToolResult, AgentContext } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to read',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const filePath = path.resolve(context.workingDirectory, params.path);
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        success: true,
        data: {
          content,
          path: filePath
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
  description: 'Write content to a file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to write',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the file',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const filePath = path.resolve(context.workingDirectory, params.path);
      await fs.writeFile(filePath, params.content, 'utf-8');

      const lines = params.content.split('\n').length;

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

export const createDirectoryTool: Tool = {
  name: 'create_directory',
  description: 'Create a new directory',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the directory to create',
      required: true
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'Create parent directories if they do not exist',
      required: false,
      default: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const dirPath = path.resolve(context.workingDirectory, params.path);
      await fs.mkdir(dirPath, { recursive: params.recursive ?? true });

      return {
        success: true,
        data: {
          path: dirPath
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create directory'
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
  listDirectoryTool,
  createDirectoryTool,
  deleteFileTool,
  fileExistsTool
];
