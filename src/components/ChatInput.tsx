import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Theme } from '../config/themes.js';

interface ChatInputProps {
  input: string;
  terminalWidth: number;
  helpText: string;
  theme: Theme;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  terminalWidth,
  helpText,
  theme,
  onInputChange,
  onSubmit
}) => {
  return (
    <Box flexDirection="column">
      <Text color={theme.colors.secondary}>{'─'.repeat(terminalWidth)}</Text>
      <Box>
        <Text color={theme.colors.secondary}>&gt; </Text>
        <TextInput
          value={input}
          onChange={onInputChange}
          onSubmit={onSubmit}
          placeholder="Type your message..."
        />
      </Box>
      <Text color={theme.colors.secondary}>{'─'.repeat(terminalWidth)}</Text>
      {helpText && (
        <Box paddingLeft={2} paddingTop={0}>
          <Text color="gray">{helpText}</Text>
        </Box>
      )}
    </Box>
  );
};

export default ChatInput;
