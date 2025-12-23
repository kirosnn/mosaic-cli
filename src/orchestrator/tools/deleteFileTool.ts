import { ToolResult, AgentContext, createTool } from '../types.js';
import * as fs from 'fs/promises';
import { PathSecurityError } from './pathValidator.js';

interface DeleteFileParams {
  path: string;
}

export const deleteFileTool = createTool<DeleteFileParams>({
  name: 'delete_file',
  description: 'Delete a file within the workspace',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to delete (must be within workspace)',
      required: true
    }
  ],
  execute: async (params: DeleteFileParams, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!context.pathValidator) {
        return {
          success: false,
          error: 'Path validation not available'
        };
      }

      const filePath = context.pathValidator.validate(params.path);
      await fs.unlink(filePath);

      return {
        success: true,
        data: {
          path: filePath
        }
      };
    } catch (error) {
      if (error instanceof PathSecurityError) {
        return {
          success: false,
          error: error.message
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  }
});