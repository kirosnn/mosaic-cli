import { Tool, ToolResult, AgentContext } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PathSecurityError } from './pathValidator.js';

export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List contents of a directory within the workspace',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the directory to list (must be within workspace)',
      required: false,
      default: '.'
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      const targetPath = params.path || '.';

      if (!context.pathValidator) {
        return { success: false, error: 'Path validation not available' };
      }

      const dirPath = context.pathValidator.validate(targetPath);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const forbidden = ['node_modules', '.env', 'package-lock.json', 'yarn.lock', 'mosaic.jsonc'];

      const files = entries
        .filter(entry => !forbidden.includes(entry.name))
        .map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(dirPath, entry.name)
        }));

      return { success: true, data: { path: dirPath, entries: files } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list directory' };
    }
  }
};