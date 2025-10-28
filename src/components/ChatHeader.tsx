import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../config/themes.js';
import { ProviderConfig } from '../config/providers.js';

interface ChatHeaderProps {
  version: string;
  provider?: ProviderConfig;
  currentDir: string;
  theme: Theme;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ version, provider, currentDir, theme }) => {
  return (
    <Box paddingX={2} paddingY={1}>
      <Box marginRight={3} flexDirection="column">
        <Text bold color={theme.colors.accent}>
          {'  ███  ███'}
        </Text>
        <Text bold color={theme.colors.accent}>
          {'    ████'}
        </Text>
        <Text bold color={theme.colors.accent}>
          {'  ███  ███'}
        </Text>
      </Box>

      <Box flexDirection="column">
        <Box>
          <Text bold color={theme.colors.primary}>Mosaic CLI</Text>
          <Text bold color={theme.colors.secondary}> · v{version}</Text>
        </Box>
        <Box>
          <Text color={theme.colors.secondary}>{provider?.model || 'Unknown'}</Text>
          <Text color={theme.colors.secondary}> · </Text>
          <Text color={theme.colors.secondary}>{provider?.type || 'Unknown'}</Text>
        </Box>
        <Box>
          <Text color={theme.colors.secondary}>{currentDir}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatHeader;
