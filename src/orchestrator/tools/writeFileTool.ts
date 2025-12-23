import { ToolResult, AgentContext, createTool } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PathSecurityError } from './pathValidator.js';

interface WriteFileParams {
  path: string;
  content: string;
}

export const writeFileTool = createTool<WriteFileParams>({
  name: 'write_file',
  description: 'Create a new file with content within the workspace. Should only be used for new files, not for modifying existing files.',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the new file to create (must be within workspace)',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write to the new file',
      required: true
    }
  ],
  execute: async (params: WriteFileParams, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!params.path || params.content === undefined) {
        return {
          success: false,
          error: 'Missing required parameters: path and content are required'
        };
      }

      if (!context.pathValidator) {
        return {
          success: false,
          error: 'Path validation not available'
        };
      }

      let filePath: string;
      let isNewExternalPath = false;

      try {
        filePath = context.pathValidator.validate(params.path);
      } catch (error) {
        if (error instanceof PathSecurityError) {
          const resolvedPath = path.resolve(context.workingDirectory, params.path);
          const dirPath = path.dirname(resolvedPath);

          try {
            await fs.access(dirPath);
            return {
              success: false,
              error: 'Cannot create files in existing external directories. Only directories created by the agent are allowed.'
            };
          } catch {
            isNewExternalPath = true;
            await fs.mkdir(dirPath, { recursive: true });
            context.pathValidator.allowPath(dirPath);
            filePath = resolvedPath;
          }
        } else {
          throw error;
        }
      }

      if (!isNewExternalPath) {
        const dirPath = path.dirname(filePath);
        try {
          await fs.mkdir(dirPath, { recursive: true });
        } catch (mkdirError) {
        }
      }

      try {
        await fs.access(filePath);
        return {
          success: false,
          error: 'File already exists. Use update_file tool to modify existing files.'
        };
      } catch {
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
});
