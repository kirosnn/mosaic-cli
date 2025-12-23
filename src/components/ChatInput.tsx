import React from 'react';
import { Box, Text } from 'ink';
import CustomTextInput from './CustomTextInput.js';
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

  const handleUpArrow = () => {
    if (!isMenuOpen && onHistoryNavigation) {
      onHistoryNavigation('up');
    }
  };

  const handleDownArrow = () => {
    if (!isMenuOpen && onHistoryNavigation) {
      onHistoryNavigation('down');
    }
  };

  return (
    <Box flexDirection="column">
      <Text color={theme.colors.secondary}>{'─'.repeat(terminalWidth)}</Text>
      <Box>
        <Text color={theme.colors.secondary}>&gt; </Text>
        <CustomTextInput
          value={input}
          onChange={onInputChange}
          onSubmit={handleSubmit}
          onUpArrow={handleUpArrow}
          onDownArrow={handleDownArrow}
          placeholder="Type your message..."
          focus={!isMenuOpen}
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