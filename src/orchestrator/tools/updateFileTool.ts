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
      description: 'Array of updates to apply. Each update contains startLine (1-indexed), endLine (1-indexed), and newContent.',
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
      const hasFinalNewline = content.endsWith('\n');

      const rawLines = content.split('\n');
      const lines =
        rawLines.length > 0 && rawLines[rawLines.length - 1] === ''
          ? rawLines.slice(0, -1)
          : rawLines;

      const originalLines = [...lines];
      const updates = params.updates;

      updates.sort((a, b) => b.startLine - a.startLine);

      const diffLines: Array<{ lineNumber: number | null; content: string; type: 'add' | 'remove' | 'context' }> = [];

      for (const update of updates) {
        if (update.startLine < 1 || update.endLine > lines.length) {
          return {
            success: false,
            error: `Invalid line range: ${update.startLine}-${update.endLine}. File has ${lines.length} lines.`
          };
        }

        const contextBefore = Math.max(0, update.startLine - 3);
        const contextAfter = Math.min(originalLines.length - 1, update.endLine + 1);

        for (let i = contextBefore; i < update.startLine - 1; i++) {
          diffLines.push({
            lineNumber: i + 1,
            content: originalLines[i],
            type: 'context'
          });
        }

        for (let i = update.startLine - 1; i <= update.endLine - 1; i++) {
          diffLines.push({
            lineNumber: i + 1,
            content: originalLines[i],
            type: 'remove'
          });
        }

        const rawNewLines = update.newContent.split('\n');
        const newLines =
          rawNewLines.length > 0 && rawNewLines[rawNewLines.length - 1] === ''
            ? rawNewLines.slice(0, -1)
            : rawNewLines;

        for (let i = 0; i < newLines.length; i++) {
          diffLines.push({
            lineNumber: update.startLine + i,
            content: newLines[i],
            type: 'add'
          });
        }

        for (let i = update.endLine; i <= contextAfter; i++) {
          if (i < originalLines.length) {
            diffLines.push({
              lineNumber: i + 1,
              content: originalLines[i],
              type: 'context'
            });
          }
        }

        lines.splice(update.startLine - 1, update.endLine - update.startLine + 1, ...newLines);
      }

      let newContent = lines.join('\n');
      if (hasFinalNewline) {
        newContent += '\n';
      }

      await fs.writeFile(filePath, newContent, 'utf-8');

      return {
        success: true,
        data: {
          path: filePath,
          updatesApplied: updates.length,
          totalLines: lines.length,
          diffLines
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