import React from 'react';
import { Box, Text } from 'ink';
import { ToolExecution, DiffLine } from '../types/toolExecution.js';
import { formatToolParameters } from '../utils/toolFormatters.js';

interface ToolExecutionListProps {
  tools: ToolExecution[];
  theme: any;
}

const ToolExecutionList: React.FC<ToolExecutionListProps> = ({ tools, theme }) => {
  const renderDiffLine = (line: DiffLine, index: number) => {
    const lineNumStr = line.lineNumber !== null ? String(line.lineNumber).padStart(4, ' ') : '    ';
    const symbol = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
    const lineContent = `${lineNumStr} ${symbol} ${line.content}`;

    if (line.type === 'add') {
      return (
        <Box key={index} paddingLeft={2}>
          <Text color={theme.code.added} backgroundColor={theme.code.addedBg}>{lineContent}</Text>
        </Box>
      );
    }

    if (line.type === 'remove') {
      return (
        <Box key={index} paddingLeft={2}>
          <Text color={theme.code.removed} backgroundColor={theme.code.removedBg}>{lineContent}</Text>
        </Box>
      );
    }

    return (
      <Box key={index} paddingLeft={2}>
        <Text color={theme.colors.secondary} dimColor>{lineNumStr}   {line.content}</Text>
      </Box>
    );
  };

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
          </Box>

          {tool.status === 'completed' && tool.diffLines && tool.diffLines.length > 0 && (
            <Box flexDirection="column">
              <Box paddingLeft={2}>
                <Text color={theme.colors.secondary}>⎿ Modified lines:</Text>
              </Box>
              {tool.diffLines.slice(0, 30).map((line, idx) => renderDiffLine(line, idx))}
              {tool.diffLines.length > 30 && (
                <Box paddingLeft={2}>
                  <Text color={theme.colors.secondary}>    ... ({tool.diffLines.length - 30} more lines)</Text>
                </Box>
              )}
            </Box>
          )}

          {tool.status === 'completed' && tool.result && !tool.diffLines && (
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