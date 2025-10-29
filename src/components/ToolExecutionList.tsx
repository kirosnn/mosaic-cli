import React from 'react';
import { Box, Text } from 'ink';
import { ToolExecution } from '../types/toolExecution.js';
import { formatToolParameters } from '../utils/toolFormatters.js';

interface ToolExecutionListProps {
  tools: ToolExecution[];
  theme: any;
}

const ToolExecutionList: React.FC<ToolExecutionListProps> = ({ tools, theme }) => {
  return (
    <>
      {tools.map((tool, index) => (
        <Box
          key={index}
          flexDirection="column"
          marginBottom={index < tools.length - 1 ? 1 : 0}
        >
          <Box>
            <Text color={theme.colors.accent}>● </Text>
            <Text color={theme.colors.text}>
              {tool.displayName}
              {tool.parameters && formatToolParameters(tool.name, tool.parameters) &&
                `(${formatToolParameters(tool.name, tool.parameters)})`}
            </Text>
            {tool.status === 'running' && (
              <Text color={theme.colors.secondary}> (running...)</Text>
            )}
          </Box>

          {tool.status === 'completed' && tool.result && (
            <Box paddingLeft={2}>
              <Text color={theme.colors.secondary}>⎿ </Text>
              <Text color={theme.colors.secondary}>{tool.result}</Text>
            </Box>
          )}

          {tool.status === 'error' && (
            <Box paddingLeft={2}>
              <Text color={theme.colors.secondary}>⎿ </Text>
              <Text color={theme.colors.error}>Error</Text>
            </Box>
          )}
        </Box>
      ))}
    </>
  );
};

export default ToolExecutionList;
