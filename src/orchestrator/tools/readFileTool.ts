import { ToolResult, AgentContext, createTool } from '../types.js';
import * as fs from 'fs/promises';
import { PathSecurityError } from './pathValidator.js';

interface ReadFileParams {
  path: string;
  offset?: number;
  limit?: number;
}

export const readFileTool = createTool<ReadFileParams>({
  name: 'read_file',
  description: 'Read the contents of a file within the workspace. Returns a compacted version with no extra line breaks or indentation to save tokens.',
  parameters: [
    { name: 'path', type: 'string', description: 'Path to the file to read (must be within workspace)', required: true },
    { name: 'offset', type: 'number', description: 'Line number to start reading from (0-based). Default: 0', required: false, default: 0 },
    { name: 'limit', type: 'number', description: 'Maximum number of lines to read. Default: unlimited', required: false }
  ],
  execute: async (params: ReadFileParams, context: AgentContext): Promise<ToolResult> => {
    try {
      if (!context.pathValidator) {
        return { success: false, error: 'Path validation not available' };
      }

      const filePath = context.pathValidator.validate(params.path);

      const forbiddenFiles = ['.env', 'package-lock.json', 'yarn.lock', 'mosaic.jsonc'];
      if (forbiddenFiles.some(f => filePath.includes(f))) {
        return { success: false, error: 'Access to this file is forbidden' };
      }

      const content = await fs.readFile(filePath, 'utf-8');

      const offset = params.offset ?? 0;
      const limit = params.limit;

      const lines = content.split('\n');
      const selectedLines = lines.slice(offset, limit ? offset + limit : undefined);

      const cleanedContent = selectedLines
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0)
        .join('\n');

      return {
        success: true,
        data: {
          content: cleanedContent,
          path: filePath,
          offset,
          linesRead: selectedLines.length,
          truncated: limit !== undefined && offset + limit < lines.length
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to read file' };
    }
  }
});