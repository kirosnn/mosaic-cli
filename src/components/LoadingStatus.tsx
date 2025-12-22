import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import GlowingText from './GlowingText.js';

interface LoadingStatusProps {
  theme: any;
  tokenCount: number;
}

const LoadingStatus: React.FC<LoadingStatusProps> = ({ theme, tokenCount }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const deciseconds = Math.floor((ms % 1000) / 100);
    return `${seconds}.${deciseconds}s`;
  };

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Box>
        <GlowingText text="Mosaic is thinking and planning" theme={theme} />
        <Text color={theme.colors.text}>... </Text>
        <Text bold color={theme.colors.secondary}>(esc</Text>
        <Text color={theme.colors.secondary}> to interrupt - ↓ {tokenCount} tokens - {formatElapsedTime(elapsedTime)})</Text>
      </Box>
    </Box>
  );
};

export default LoadingStatus;
