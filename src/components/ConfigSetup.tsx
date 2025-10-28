import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getThemeNames, getTheme, Theme } from '../config/themes.js';
import { updateConfig } from '../config/index.js';
import ProviderSetup from './ProviderSetup.js';
import { ProviderType } from '../config/providers.js';

interface ConfigSetupProps {
  missingConfigs: string[];
  onComplete: () => void;
}

const ThemePreview: React.FC<{ theme: Theme }> = ({ theme }) => {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>Preview: {theme.name}</Text>
      </Box>

      <Box flexDirection="column">
        <Text color={theme.colors.secondary}>Code Colors:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Box>
            <Text backgroundColor={theme.code.addedBg} bold color="white"> + Added </Text>
            <Text> </Text>
            <Text backgroundColor={theme.code.removedBg} bold color="white"> - Removed </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.code.keyword}>keyword </Text>
            <Text color={theme.code.string}>"string" </Text>
            <Text color={theme.code.number}>123 </Text>
            <Text color={theme.code.function}>function</Text>
            <Text color={theme.code.comment}> // comment</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const ConfigSetup: React.FC<ConfigSetupProps> = ({ missingConfigs, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [showProviderSetup, setShowProviderSetup] = useState(false);

  const steps = missingConfigs.map(config => {
    if (config === 'theme') {
      return {
        key: 'theme',
        type: 'theme' as const,
        question: 'Choose your theme:',
        options: getThemeNames().map(name => ({
          value: name,
          label: getTheme(name).name,
        })),
      };
    }
    if (config === 'provider') {
      return {
        key: 'provider',
        type: 'provider' as const,
        question: 'Configure AI Provider:',
        options: [],
      };
    }
    return null;
  }).filter(Boolean) as Array<{
    key: string;
    type: 'theme' | 'provider';
    question: string;
    options: Array<{ value: string; label: string }>;
  }>;

  useInput((input, key) => {
    if (showProviderSetup) return;

    if (key.upArrow) {
      setSelectedIndex(prev =>
        prev > 0 ? prev - 1 : steps[currentStep].options.length - 1
      );
    } else if (key.downArrow) {
      setSelectedIndex(prev =>
        prev < steps[currentStep].options.length - 1 ? prev + 1 : 0
      );
    } else if (key.return) {
      const currentStepData = steps[currentStep];

      if (currentStepData.type === 'provider') {
        setShowProviderSetup(true);
        return;
      }

      const selectedValue = currentStepData.options[selectedIndex].value;

      const newConfigs = {
        ...configs,
        [currentStepData.key]: selectedValue,
      };

      setConfigs(newConfigs);

      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
        setSelectedIndex(0);
      } else {
        updateConfig(newConfigs);
        onComplete();
      }
    }
  });

  const handleProviderComplete = (provider: { type: ProviderType; model: string; baseUrl?: string }) => {
    const newConfigs = {
      ...configs,
      provider,
    };

    setConfigs(newConfigs);
    setShowProviderSetup(false);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setSelectedIndex(0);
    } else {
      updateConfig(newConfigs);
      onComplete();
    }
  };

  if (steps.length === 0) {
    onComplete();
    return null;
  }

  const currentStepData = steps[currentStep];

  if (showProviderSetup) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="blue">
            Configuration setup ({currentStep + 1}/{steps.length})
          </Text>
        </Box>
        <ProviderSetup onComplete={handleProviderComplete} />
      </Box>
    );
  }

  const selectedTheme = currentStepData.type === 'theme'
    ? getTheme(currentStepData.options[selectedIndex].value)
    : null;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="blue">
          Configuration setup ({currentStep + 1}/{steps.length})
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>{currentStepData.question}</Text>
      </Box>

      {currentStepData.type === 'provider' ? (
        <>
          <Box marginLeft={2}>
            <Text color="gray">Press Enter to configure your AI provider</Text>
          </Box>
        </>
      ) : (
        <>
          <Box>
            <Box flexDirection="column" width="50%">
              {currentStepData.options.map((option, index) => (
                <Box key={option.value} marginLeft={2}>
                  <Text color={index === selectedIndex ? 'blue' : 'white'}>
                    {index === selectedIndex ? '› ' : '  '}
                    {option.label}
                  </Text>
                </Box>
              ))}
            </Box>

            {selectedTheme && (
              <Box width="50%" marginLeft={2}>
                <ThemePreview theme={selectedTheme} />
              </Box>
            )}
          </Box>

          <Box marginTop={1}>
            <Text color="gray">Use ↑↓ arrows to navigate, Enter to select</Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default ConfigSetup;
