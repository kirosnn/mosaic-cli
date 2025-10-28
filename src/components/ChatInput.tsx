import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Theme } from '../config/themes.js';

interface ChatInputProps {
  input: string;
  terminalWidth: number;
  helpText: string;
  theme: Theme;
  isMenuOpen?: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onHistoryNavigation?: (direction: 'up' | 'down') => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  terminalWidth,
  helpText,
  theme,
  isMenuOpen = false,
  onInputChange,
  onSubmit,
  onHistoryNavigation
}) => {
  const handleSubmit = (value: string) => {
    if (!isMenuOpen) {
      onSubmit(value);
    }
  };

  useInput((inputChar, key) => {
    if (isMenuOpen) {
      return;
    }

    if (onHistoryNavigation) {
      if (key.upArrow && input === '') {
        onHistoryNavigation('up');
      } else if (key.downArrow && input !== '') {
        onHistoryNavigation('down');
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Text color={theme.colors.secondary}>{'─'.repeat(terminalWidth)}</Text>
      <Box>
        <Text color={theme.colors.secondary}>&gt; </Text>
        <TextInput
          value={input}
          onChange={onInputChange}
          onSubmit={handleSubmit}
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
