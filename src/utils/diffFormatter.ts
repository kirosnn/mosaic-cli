import fs from 'fs';

export interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: 'add' | 'remove' | 'context';
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