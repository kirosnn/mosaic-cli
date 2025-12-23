import { Tool, ToolResult, AgentContext } from '../types.js';
import * as fs from 'fs/promises';
import { PathSecurityError } from './pathValidator.js';

export const fileExistsTool: Tool = {
  name: 'file_exists',
  description: 'Check if a file or directory exists within the workspace',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to check (must be within workspace)',
      required: true
    }
  ],
  execute: async (params: Record<string, any>, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!context.pathValidator) {
        return {
          success: false,
          error: 'Path validation not available'
        };
      }

      const filePath = context.pathValidator.validate(params.path);

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
