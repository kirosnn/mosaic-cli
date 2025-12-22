import React from 'react';
import { Box, Text } from 'ink';
import { MessageWithTools } from '../types/toolExecution.js';

interface RewindSelectorProps {
  messages: MessageWithTools[];
  selectedIndex: number;
  theme: any;
}

const RewindSelector: React.FC<RewindSelectorProps> = ({ messages, selectedIndex, theme }) => {
  const formatTimestamp = (index: number): string => {
    return `Message ${index + 1}`;
  };

  const getPreview = (msg: MessageWithTools, maxLength: number = 60): string => {
    const content = msg.content || '';
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  const getUserMessages = messages
    .map((msg, index) => ({ msg, originalIndex: index }))
    .filter(item => item.msg.role === 'user');

  if (getUserMessages.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box borderStyle="round" borderColor={theme.primary} paddingX={2} paddingY={1}>
          <Text color={theme.text}>No messages to rewind to</Text>
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
              Select a message to rewind to:
            </Text>
          </Box>

          {getUserMessages.map((item, index) => {
            const isSelected = index === selectedIndex;
            const hasToolExecutions = item.msg.toolExecutions && item.msg.toolExecutions.length > 0;

            return (
              <Box key={item.originalIndex} flexDirection="column" marginBottom={1}>
                <Box>
                  <Text
                    color={isSelected ? theme.highlight : theme.text}
                    bold={isSelected}
                  >
                    {isSelected ? '> ' : '  '}
                    {formatTimestamp(item.originalIndex)}
                    {': '}
                    <Text color={isSelected ? theme.highlight : theme.secondaryText}>
                      {getPreview(item.msg)}
                    </Text>
                  </Text>
                </Box>
                {hasToolExecutions && (
                  <Box paddingLeft={4}>
                    <Text color={theme.warning} dimColor={!isSelected}>
                      {item.msg.toolExecutions!.length} tool(s) executed
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

export default RewindSelector;
