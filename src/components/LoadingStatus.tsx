import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import GlowingText from './GlowingText.js';

interface LoadingStatusProps {
  theme: any;
  tokenCount: number;
  terminalWidth?: number;
}

const LoadingStatus: React.FC<LoadingStatusProps> = ({ theme, tokenCount, terminalWidth }) => {
  const { stdout } = useStdout();
  const width = terminalWidth ?? stdout?.columns ?? 80;
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const formatTokens = (count: number): string => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const formatElapsedTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);

    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (totalMinutes < 60) {
      return `${totalMinutes}m ${seconds}s`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  };

  const showTokens = tokenCount > 0;

  return (
    <Box flexDirection="column">
      <Box width={width - 4}>
        <Text color={theme.colors.secondary}>(</Text>
        <GlowingText text="Mosaic is thinking and planning..." theme={theme} />
        <Text color={theme.colors.secondary}> — </Text>
        <Text bold italic color={theme.colors.secondary}>esc</Text>
        <Text color={theme.colors.secondary}> to interrupt</Text>
        {showTokens && (
          <>
            <Text color={theme.colors.secondary}> — </Text>
            <Text color={theme.colors.secondary}>{formatTokens(tokenCount)} tokens</Text>
          </>
        )}
        <Text color={theme.colors.secondary}> — </Text>
        <Text color={theme.colors.secondary}>{formatElapsedTime(elapsedTime)}</Text>
        <Text color={theme.colors.secondary}>)</Text>
      </Box>
    </Box>
  );
};

export default LoadingStatus;