import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
  ProviderType,
  PROVIDERS,
  getProviderOption,
  getProviderTypes
} from '../config/providers.js';
import { setSecret } from '../config/secrets.js';

interface ProviderSetupProps {
  onComplete: (provider: { type: ProviderType; model: string; baseUrl?: string }) => void;
}

type SetupStep = 'provider' | 'model' | 'apiKey' | 'baseUrl';

const ProviderSetup: React.FC<ProviderSetupProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<SetupStep>('provider');
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [customModel, setCustomModel] = useState('');
  const [isCustomModel, setIsCustomModel] = useState(false);

  const providerTypes = getProviderTypes();
  const providerOptions = selectedProvider
    ? [...getProviderOption(selectedProvider).defaultModels, 'Custom model']
    : [];

  useInput((input, key) => {
    if (currentStep === 'provider') {
      if (key.upArrow) {
        setSelectedProviderIndex(prev =>
          prev > 0 ? prev - 1 : providerTypes.length - 1
        );
      } else if (key.downArrow) {
        setSelectedProviderIndex(prev =>
          prev < providerTypes.length - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        const provider = providerTypes[selectedProviderIndex];
        setSelectedProvider(provider);
        setCurrentStep('model');
      }
    } else if (currentStep === 'model' && !isCustomModel) {
      if (key.upArrow) {
        setSelectedModelIndex(prev =>
          prev > 0 ? prev - 1 : providerOptions.length - 1
        );
      } else if (key.downArrow) {
        setSelectedModelIndex(prev =>
          prev < providerOptions.length - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        const selectedOption = providerOptions[selectedModelIndex];
        if (selectedOption === 'Custom model') {
          setIsCustomModel(true);
        } else {
          setSelectedModel(selectedOption);
          handleModelSelected(selectedOption);
        }
      }
    }
  }, { isActive: currentStep === 'provider' || (currentStep === 'model' && !isCustomModel) });

  const handleModelSelected = (model: string) => {
    if (!selectedProvider) return;

    const providerOption = getProviderOption(selectedProvider);

    if (providerOption.requiresApiKey) {
      setCurrentStep('apiKey');
    } else if (providerOption.requiresBaseUrl) {
      setCurrentStep('baseUrl');
    } else {
      onComplete({
        type: selectedProvider,
        model,
      });
    }
  };

  const handleApiKeySubmit = (value: string) => {
    if (!selectedProvider || !selectedModel) return;

    if (value.trim()) {
      setSecret(`${selectedProvider}_api_key`, value.trim());
    }

    const providerOption = getProviderOption(selectedProvider);
    if (providerOption.requiresBaseUrl) {
      setCurrentStep('baseUrl');
    } else {
      onComplete({
        type: selectedProvider,
        model: selectedModel,
      });
    }
  };

  const handleBaseUrlSubmit = (value: string) => {
    if (!selectedProvider || !selectedModel) return;

    onComplete({
      type: selectedProvider,
      model: selectedModel,
      baseUrl: value.trim() || baseUrl,
    });
  };

  const handleCustomModelSubmit = (value: string) => {
    if (value.trim()) {
      setSelectedModel(value.trim());
      handleModelSelected(value.trim());
    }
  };

  if (currentStep === 'provider') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="blue">Choose your AI provider:</Text>
        </Box>

        <Box flexDirection="column">
          {providerTypes.map((type, index) => {
            const provider = PROVIDERS[type];
            return (
              <Box key={type} marginLeft={2}>
                <Text color={index === selectedProviderIndex ? 'blue' : 'white'}>
                  {index === selectedProviderIndex ? '› ' : '  '}
                  {provider.name}
                  {!provider.requiresApiKey && ' (No API key required)'}
                </Text>
              </Box>
            );
          })}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Use ↑↓ arrows to navigate, Enter to select</Text>
        </Box>
      </Box>
    );
  }

  if (currentStep === 'model') {
    if (isCustomModel) {
      return (
        <Box flexDirection="column" padding={1}>
          <Box marginBottom={1}>
            <Text bold color="blue">Enter custom model name:</Text>
          </Box>

          <Box marginLeft={2}>
            <Text color="gray">Model: </Text>
            <TextInput
              value={customModel}
              onChange={setCustomModel}
              onSubmit={handleCustomModelSubmit}
            />
          </Box>

          <Box marginTop={1}>
            <Text color="gray">Press Enter to confirm</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="blue">Choose your model:</Text>
        </Box>

        <Box flexDirection="column">
          {providerOptions.map((model, index) => (
            <Box key={model} marginLeft={2}>
              <Text color={index === selectedModelIndex ? 'blue' : 'white'}>
                {index === selectedModelIndex ? '› ' : '  '}
                {model}
              </Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Use ↑↓ arrows to navigate, Enter to select</Text>
        </Box>
      </Box>
    );
  }

  if (currentStep === 'apiKey') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="blue">Enter your API key:</Text>
        </Box>

        <Box marginLeft={2} flexDirection="column">
          <Box marginBottom={1}>
            <Text color="yellow">
              Your API key will be securely stored in .mosaic/.secrets.json
            </Text>
          </Box>

          <Box>
            <Text color="gray">API Key: </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Press Enter to confirm (or leave empty to skip)</Text>
        </Box>
      </Box>
    );
  }

  if (currentStep === 'baseUrl') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="blue">Enter base URL:</Text>
        </Box>

        <Box marginLeft={2}>
          <Text color="gray">Base URL: </Text>
          <TextInput
            value={baseUrl}
            onChange={setBaseUrl}
            onSubmit={handleBaseUrlSubmit}
          />
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Press Enter to confirm</Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default ProviderSetup;
