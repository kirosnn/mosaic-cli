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
    'install_package': 'Install'
  };

  return nameMap[toolName] || toolName;
};

export const formatToolResult = (toolName: string, result: any, parameters?: Record<string, any>): string => {
  if (!result) return '';

  try {
    const data = typeof result === 'string' ? JSON.parse(result) : result;

    switch (toolName) {
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
      return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }

    return String(data);
  } catch {
    return String(result).substring(0, 50);
  }
};

export const formatToolParameters = (toolName: string, parameters?: Record<string, any>): string => {
  if (!parameters) return '';

  switch (toolName) {
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
