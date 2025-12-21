import React, { useRef, useEffect } from 'react';
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
  const isHistoryNavigationRef = useRef(false);
  const previousInputRef = useRef(input);

  useEffect(() => {
    if (isHistoryNavigationRef.current && previousInputRef.current !== input) {
      isHistoryNavigationRef.current = false;
    }
    previousInputRef.current = input;
  }, [input]);

  const handleSubmit = (value: string) => {
    if (!isMenuOpen) {
      onSubmit(value);
    }
  };

  const handleChange = (value: string) => {
    if (!isHistoryNavigationRef.current) {
      onInputChange(value);
    }
  };

  useInput((inputChar, key) => {
    if (isMenuOpen) {
      return;
    }

    if (onHistoryNavigation) {
      if (key.upArrow) {
        isHistoryNavigationRef.current = true;
        onHistoryNavigation('up');
      } else if (key.downArrow) {
        isHistoryNavigationRef.current = true;
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
          onChange={handleChange}
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