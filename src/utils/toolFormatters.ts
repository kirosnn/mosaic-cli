interface FileStructure {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileStructure[];
  size?: number;
}

const countFilesAndDirs = (structure: FileStructure[]): { files: number; dirs: number } => {
  let files = 0;
  let dirs = 0;

  for (const item of structure) {
    if (item.type === 'file') {
      files++;
    } else if (item.type === 'directory') {
      dirs++;
      if (item.children && item.children.length > 0) {
        const childCounts = countFilesAndDirs(item.children);
        files += childCounts.files;
        dirs += childCounts.dirs;
      }
    }
  }

  return { files, dirs };
};

export const formatToolName = (toolName: string): string => {
  const nameMap: Record<string, string> = {
    'read_file': 'Read',
    'write_file': 'Write',
    'update_file': 'Update',
    'list_directory': 'List',
    'create_directory': 'CreateDir',
    'delete_file': 'Delete',
    'file_exists': 'FileExists',
    'execute_shell': 'Shell',
    'execute_node': 'Node',
    'search_code': 'Search',
    'install_package': 'Install',
    'explore_workspace': 'Explore'
  };

  return nameMap[toolName] || toolName;
};

export const formatToolResult = (toolName: string, result: any, parameters?: Record<string, any>): string => {
  if (!result) return '';

  try {
    const data = typeof result === 'string' ? JSON.parse(result) : result;

    switch (toolName) {
      case 'explore_workspace':
        if (data.structure && Array.isArray(data.structure)) {
          const counts = countFilesAndDirs(data.structure);
          return `Analyzed ${counts.files} files in ${counts.dirs} directories`;
        }
        if (data.summary) {
          return 'Workspace exploration completed';
        }
        if (data.files || data.directories) {
          const files = Array.isArray(data.files) ? data.files.length : 0;
          const dirs = Array.isArray(data.directories) ? data.directories.length : 0;
          return `Found ${files} files, ${dirs} directories`;
        }
        return 'Workspace exploration completed';
      case 'read_file':
        if (data.content !== undefined && data.content !== null) {
          const lines = String(data.content).split('\n').length;
          return `Read ${lines} lines`;
        }
        break;
      case 'write_file':
        if (data.bytesWritten) {
          return `Wrote ${data.lines} lines`;
        }
        break;
      case 'update_file':
        if (data.updatesApplied !== undefined) {
          return `Applied ${data.updatesApplied} update(s)`;
        }
        break;
      case 'list_directory':
        if (data.entries) {
          return `Found ${data.entries.length} items`;
        }
        break;
      case 'execute_shell':
        {
          const stdout = (data.stdout ?? '').trim();
          const stderr = (data.stderr ?? '').trim();
          const preferred = stdout || stderr;

          if (preferred) {
            return preferred.length > 50 ? preferred.substring(0, 47) + '...' : preferred;
          }
          if (data.output) {
            const output = String(data.output).trim();
            return output.length > 50 ? output.substring(0, 47) + '...' : output;
          }
          break;
        }
      case 'search_code':
        if (data.count !== undefined) {
          return `Found ${data.count} matches`;
        }
        break;
      case 'install_package':
        if (data.package) {
          return `Installed ${data.package}`;
        }
        break;
    }

    if (typeof data === 'object') {
      const str = JSON.stringify(data);
      return str.length > 80 ? str.substring(0, 77) + '...' : str;
    }

    return String(data);
  } catch {
    return String(result).substring(0, 80);
  }
};

export const formatToolParameters = (toolName: string, parameters?: Record<string, any>): string => {
  if (!parameters) return '';

  switch (toolName) {
    case 'explore_workspace':
      return parameters.workingDirectory ?
        (parameters.workingDirectory.length > 40 ?
          '...' + parameters.workingDirectory.slice(-37) :
          parameters.workingDirectory) :
        'workspace';
    case 'read_file':
    case 'write_file':
    case 'update_file':
    case 'delete_file':
      return parameters.path || '';
    case 'list_directory':
      return parameters.path || '.';
    case 'execute_shell':
      return parameters.command || '';
    case 'search_code':
      return parameters.pattern || '';
    case 'install_package':
      return parameters.package || '';
    default:
      return '';
  }
};
