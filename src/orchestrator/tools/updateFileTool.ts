import { ToolResult, AgentContext, createTool } from '../types.js';
import * as fs from 'fs/promises';
import { PathSecurityError } from './pathValidator.js';

interface FileUpdate {
  startLine: number;
  endLine: number;
  newContent: string;
}

interface UpdateFileParams {
  path: string;
  updates: FileUpdate[];
}

export const updateFileTool = createTool<UpdateFileParams>({
  name: 'update_file',
  description: 'Update specific lines in an existing file within the workspace. Can modify multiple line ranges at once. IMPORTANT: Line numbers are 1-indexed (first line is 1, not 0). To replace the entire file content, use startLine=1 and endLine=<total lines>.',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to the file to update (must be within workspace)',
      required: true
    },
    {
      name: 'updates',
      type: 'array',
      description: 'Array of updates to apply. Each update contains startLine (1-indexed), endLine (1-indexed), and newContent. Example: [{startLine: 1, endLine: 1, newContent: "new text"}] replaces the first line.',
      required: true
    }
  ],
  execute: async (params: UpdateFileParams, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!context.pathValidator) {
        return {
          success: false,
          error: 'Path validation not available'
        };
      }

      const filePath = context.pathValidator.validate(params.path);

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = String(content || '').split('\n');

      const updates = params.updates;

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
});
