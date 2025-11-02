import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Theme } from '../config/themes.js';
import { ProviderConfig } from '../config/providers.js';

interface ChatHeaderProps {
  version: string;
  provider?: ProviderConfig;
  currentDir: string;
  theme: Theme;
}

interface FormattingConfig {
  providers: Record<string, string>;
  models: Record<string, string>;
}

let formattingCache: FormattingConfig | null = null;

const loadFormattingConfig = (): FormattingConfig => {
  if (formattingCache) {
    return formattingCache;
  }

  try {
    const projectRoot = process.cwd();
    const configPath = join(projectRoot, 'config', 'formatting.json');

    if (existsSync(configPath)) {
      const data = readFileSync(configPath, 'utf-8');
      formattingCache = JSON.parse(data);
      return formattingCache!;
    }
  } catch (error) {
    console.error('Error loading formatting config:', error);
  }

  return { providers: {}, models: {} };
};

const formatProviderName = (type?: string): string => {
  if (!type) return 'Unknown';
  const config = loadFormattingConfig();
  const formatted = config.providers[type.toLowerCase()];
  if (formatted) {
    return formatted;
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const formatModelName = (model?: string): string => {
  if (!model) return 'Unknown';
  const config = loadFormattingConfig();
  const formatted = config.models[model.toLowerCase()];
  if (formatted) {
    return formatted;
  }
  return model
    .split(/[\/\-\s]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const ChatHeader: React.FC<ChatHeaderProps> = ({ version, provider, currentDir, theme }) => {
  const formattedProvider = useMemo(() => formatProviderName(provider?.type), [provider?.type]);
  const formattedModel = useMemo(() => formatModelName(provider?.model), [provider?.model]);

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
          <Text color={theme.colors.secondary}>{formattedModel}</Text>
          <Text color={theme.colors.secondary}> · </Text>
          <Text color={theme.colors.secondary}>{formattedProvider}</Text>
        </Box>
        <Box>
          <Text color={theme.colors.secondary}>{currentDir}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatHeader;
