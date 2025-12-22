import fs from 'fs';

export interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: 'add' | 'remove' | 'context' | 'empty';
}

export interface ToolPreviewData {
  toolName: string;
  filePath: string;
  diffLines: DiffLine[];
  command?: string;
}

export const generateWritePreview = (path: string, content: string): string => {
  const safeContent = content || '';
  const lines = safeContent.split('\n');
  let preview = `Writing to: ${path}\n\n`;

  lines.forEach((line, index) => {
    const lineNum = (index + 1).toString().padStart(4, ' ');
    preview += `  ${lineNum} +  ${line}\n`;
  });

  return preview;
};

export const generateUpdatePreview = (path: string, oldContent: string, newContent: string, contextLines: number = 3): string => {
  const safeOldContent = oldContent || '';
  const safeNewContent = newContent || '';
  const oldLines = safeOldContent.split('\n');
  const newLines = safeNewContent.split('\n');

  let preview = `Updating: ${path}\n\n`;

  const changes: Array<{ start: number, end: number, type: 'modify' }> = [];

  for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
    if (oldLines[i] !== newLines[i]) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(Math.max(oldLines.length, newLines.length) - 1, i + contextLines);

      const merged = changes.length > 0 && start <= changes[changes.length - 1].end + 1;
      if (merged) {
        changes[changes.length - 1].end = end;
      } else {
        changes.push({ start, end, type: 'modify' });
      }
    }
  }

  changes.forEach((change, changeIndex) => {
    if (changeIndex > 0) {
      preview += '\n  ...\n\n';
    }

    for (let i = change.start; i <= change.end; i++) {
      const lineNum = (i + 1).toString().padStart(4, ' ');

      if (i < oldLines.length && i < newLines.length) {
        if (oldLines[i] === newLines[i]) {
          preview += `  ${lineNum}    ${oldLines[i]}\n`;
        } else {
          preview += `  ${lineNum} -  ${oldLines[i]}\n`;
          preview += `  ${lineNum} +  ${newLines[i]}\n`;
        }
      } else if (i < oldLines.length) {
        preview += `  ${lineNum} -  ${oldLines[i]}\n`;
      } else if (i < newLines.length) {
        preview += `  ${lineNum} +  ${newLines[i]}\n`;
      }
    }
  });

  return preview;
};

export const generateDeletePreview = (path: string): string => {
  try {
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      return `Deleting directory: ${path}\n\nThis will remove the entire directory and all its contents.`;
    } else {
      const content = fs.readFileSync(path, 'utf-8');
      const safeContent = content || '';
      const lines = safeContent.split('\n');
      let preview = `Deleting file: ${path}\n\n`;

      lines.forEach((line, index) => {
        const lineNum = (index + 1).toString().padStart(4, ' ');
        preview += `  ${lineNum} -  ${line}\n`;
      });

      return preview;
    }
  } catch (error) {
    return `Deleting: ${path}\n\nFile does not exist or cannot be read.`;
  }
};

export const generateCreateDirectoryPreview = (path: string): string => {
  return `Creating directory: ${path}\n\nA new directory will be created at this location.`;
};

export const generateExecuteShellPreview = (command: string): string => {
  return `Executing shell command:\n\n  $ ${command}\n\nThis command will be executed in your system shell.`;
};

export const generateWriteDiffLines = (content: string): DiffLine[] => {
  const safeContent = content || '';
  const lines = safeContent.split('\n');
  const diffLines: DiffLine[] = [];

  lines.forEach((line, index) => {
    diffLines.push({
      lineNumber: index + 1,
      content: line,
      type: 'add'
    });
  });

  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    diffLines.push({
      lineNumber: null,
      content: 'No newline at end of file',
      type: 'empty'
    });
  }

  return diffLines;
};

export const generateUpdateDiffLines = (oldContent: string, newContent: string): DiffLine[] => {
  const safeOldContent = oldContent || '';
  const safeNewContent = newContent || '';
  const oldLines = safeOldContent.split('\n');
  const newLines = safeNewContent.split('\n');
  const diffLines: DiffLine[] = [];

  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine !== undefined && newLine !== undefined) {
      if (oldLine === newLine) {
        diffLines.push({
          lineNumber: i + 1,
          content: oldLine,
          type: 'context'
        });
      } else {
        diffLines.push({
          lineNumber: i + 1,
          content: oldLine,
          type: 'remove'
        });
        diffLines.push({
          lineNumber: i + 1,
          content: newLine,
          type: 'add'
        });
      }
    } else if (oldLine !== undefined) {
      diffLines.push({
        lineNumber: i + 1,
        content: oldLine,
        type: 'remove'
      });
    } else if (newLine !== undefined) {
      diffLines.push({
        lineNumber: i + 1,
        content: newLine,
        type: 'add'
      });
    }
  }

  const oldEndsWithNewline = safeOldContent.endsWith('\n') || safeOldContent === '';
  const newEndsWithNewline = safeNewContent.endsWith('\n') || safeNewContent === '';

  if (!oldEndsWithNewline && oldLines.length > 0) {
    diffLines.push({
      lineNumber: null,
      content: 'No newline at end of file',
      type: 'empty'
    });
  }

  if (!newEndsWithNewline && newLines.length > 0 && newEndsWithNewline !== oldEndsWithNewline) {
    diffLines.push({
      lineNumber: null,
      content: 'No newline at end of file',
      type: 'empty'
    });
  }

  return diffLines;
};

export const generateDeleteDiffLines = (path: string): DiffLine[] => {
  try {
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      return [{
        lineNumber: null,
        content: 'This will remove the entire directory and all its contents.',
        type: 'empty'
      }];
    } else {
      const content = fs.readFileSync(path, 'utf-8');
      const safeContent = content || '';
      const lines = safeContent.split('\n');
      const diffLines: DiffLine[] = [];

      lines.forEach((line, index) => {
        diffLines.push({
          lineNumber: index + 1,
          content: line,
          type: 'remove'
        });
      });

      return diffLines;
    }
  } catch (error) {
    return [{
      lineNumber: null,
      content: 'File does not exist or cannot be read.',
      type: 'empty'
    }];
  }
};

export const generateExecuteShellDiffLines = (command: string): DiffLine[] => {
  return [{
    lineNumber: null,
    content: `$ ${command}`,
    type: 'context'
  }, {
    lineNumber: null,
    content: 'This command will be executed in your system shell.',
    type: 'empty'
  }];
};

export const generateToolPreviewData = async (toolName: string, parameters: Record<string, any>): Promise<ToolPreviewData> => {
  let diffLines: DiffLine[] = [];
  let filePath = '';
  let command = '';

  switch (toolName) {
    case 'write_file':
      filePath = parameters.path;
      diffLines = generateWriteDiffLines(parameters.content);
      break;

    case 'update_file':
      filePath = parameters.path;
      try {
        const oldContent = fs.readFileSync(parameters.path, 'utf-8');

        if (parameters.content !== undefined) {
          diffLines = generateUpdateDiffLines(oldContent, parameters.content);
        } else if (parameters.updates && Array.isArray(parameters.updates)) {
          const oldLines = oldContent.split('\n');
          const newLines = [...oldLines];

          const sortedUpdates = [...parameters.updates].sort((a, b) => b.startLine - a.startLine);

          for (const update of sortedUpdates) {
            const updateLines = update.newContent.split('\n');
            newLines.splice(update.startLine - 1, update.endLine - update.startLine + 1, ...updateLines);
          }

          const newContent = newLines.join('\n');
          diffLines = generateUpdateDiffLines(oldContent, newContent);
        } else {
          diffLines = [{
            lineNumber: null,
            content: 'Invalid update parameters',
            type: 'empty'
          }];
        }
      } catch (error) {
        if (parameters.content) {
          diffLines = generateWriteDiffLines(parameters.content);
        } else {
          diffLines = [{
            lineNumber: null,
            content: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'empty'
          }];
        }
      }
      break;

    case 'delete_file':
      filePath = parameters.path;
      diffLines = generateDeleteDiffLines(parameters.path);
      break;

    case 'execute_shell':
      command = parameters.command;
      filePath = 'shell';
      diffLines = generateExecuteShellDiffLines(parameters.command);
      break;

    default:
      filePath = 'unknown';
      diffLines = [{
        lineNumber: null,
        content: JSON.stringify(parameters, null, 2),
        type: 'context'
      }];
  }

  return {
    toolName,
    filePath,
    diffLines,
    command
  };
};

export const generateToolPreview = async (toolName: string, parameters: Record<string, any>): Promise<string> => {
  switch (toolName) {
    case 'write_file':
      return generateWritePreview(parameters.path, parameters.content);

    case 'update_file':
      try {
        const oldContent = fs.readFileSync(parameters.path, 'utf-8');
        const newContent = parameters.content;
        return generateUpdatePreview(parameters.path, oldContent, newContent);
      } catch (error) {
        return generateWritePreview(parameters.path, parameters.content);
      }

    case 'delete_file':
      return generateDeletePreview(parameters.path);

    case 'create_directory':
      return generateCreateDirectoryPreview(parameters.path);

    case 'execute_shell':
      return generateExecuteShellPreview(parameters.command);

    default:
      return `Tool: ${toolName}\nParameters: ${JSON.stringify(parameters, null, 2)}`;
  }
};