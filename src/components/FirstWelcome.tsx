import { Text, Box, Newline, useInput } from 'ink';
import React, { useState } from 'react';
import { getPackageVersion } from '../config/index.js';

const version = getPackageVersion();

interface FirstWelcomeProps {
  onComplete: () => void;
  showPrompt?: boolean;
  enableInput?: boolean;
}

const FirstWelcome: React.FC<FirstWelcomeProps> = ({
  onComplete,
  showPrompt = true,
  enableInput = true
}) => {
  const [promptVisible, setPromptVisible] = useState(true);

  useInput((input, key) => {
    if (enableInput && key.return) {
      setPromptVisible(false);
      setTimeout(() => {
        onComplete();
      }, 100);
    }
  });

  return (
    <>
      <Newline />
      <Box justifyContent="center">
        <Box marginRight={3}>
          <Text bold color="blue">
            {'  ███  ███\n'}
            {'    ████\n'}
            {'  ███  ███\n'}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text bold color="gray">Mosaic welcomes you !</Text>
          <Text bold color="gray">Mosaic CLI v{version}</Text>
          <Text bold color="gray">Now are you ready to configure it ?</Text>
        </Box>
      </Box>
      {showPrompt && promptVisible && (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray">Press Enter to continue...</Text>
        </Box>
      )}
      <Newline />
    </>
  );
};

export default FirstWelcome;