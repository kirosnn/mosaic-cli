import React from 'react';
import { Box, Text } from 'ink';
import { IDEInstance } from '../services/ideIntegration/types.js';

interface IdeSelectorProps {
  instances: IDEInstance[];
  selectedIndex: number;
  theme: any;
}

const IdeSelector: React.FC<IdeSelectorProps> = ({ instances, selectedIndex, theme }) => {
  const getIDEIcon = (type: string): string => {
    switch (type) {
      case 'vscode':
        return '[VSCode]';
      case 'cursor':
        return '[Cursor]';
      case 'windsurf':
        return '[Windsurf]';
      default:
        return '[IDE]';
    }
  };

  const formatWorkspace = (workspacePath?: string): string => {
    if (!workspacePath) {
      return 'No workspace';
    }

    const parts = workspacePath.split(/[/\\]/);
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts.length > 1 ? parts[parts.length - 2] : null;

    if (secondLastPart) {
      return `...\\${secondLastPart}\\${lastPart}`;
    }

    return lastPart;
  };

  if (instances.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1}>
          <Text color={theme.text}>No running IDEs detected. Please open VSCode, Cursor, or Windsurf.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1}>
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold color={theme.primary}>
              Select an IDE to interact with:
            </Text>
          </Box>

          {instances.map((instance, index) => {
            const isSelected = index === selectedIndex;

            return (
              <Box key={instance.processId} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text
                    color={isSelected ? theme.highlight : theme.text}
                    bold={isSelected}
                  >
                    {isSelected ? '> ' : '  '}
                    {getIDEIcon(instance.type)}
                    {' '}
                    {instance.name}
                    {' - '}
                    <Text color={isSelected ? theme.highlight : theme.secondaryText}>
                      {formatWorkspace(instance.workspacePath)}
                    </Text>
                  </Text>
                </Box>
                {isSelected && instance.workspacePath && (
                  <Box paddingLeft={4}>
                    <Text color={theme.secondaryText} dimColor>
                      Full path: {instance.workspacePath}
                    </Text>
                  </Box>
                )}
              </Box>
            );
          })}

          <Box marginTop={1} paddingTop={1} borderStyle="single" borderColor={theme.border}>
            <Text color={theme.secondaryText}>
              Use ↑/↓ to navigate, Enter to select, Esc to cancel
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default IdeSelector;
