import React from 'react';
import { Box, Text } from 'ink';
import GlowingText from './GlowingText.js';

interface LoadingStatusProps {
  theme: any;
  tokenCount: number;
}

const LoadingStatus: React.FC<LoadingStatusProps> = ({ theme, tokenCount }) => {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Box>
        <GlowingText text="Agent is thinking and planning" theme={theme} />
        <Text color={theme.colors.text}>... </Text>
        <Text bold color={theme.colors.secondary}>(esc</Text>
        <Text color={theme.colors.secondary}> to interrupt - ↓ {tokenCount} tokens)</Text>
      </Box>
    </Box>
  );
};

export default LoadingStatus;