import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../config/themes.js';

interface MenuItem {
  key: string;
  description: string;
}

interface DropdownMenuProps {
  items: MenuItem[];
  selectedIndex: number;
  theme: Theme;
  title: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, selectedIndex, theme, title }) => {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>{title}</Text>
      </Box>
      {items.map((item, index) => (
        <Box key={index}>
          <Text color={index === selectedIndex ? theme.colors.accent : theme.colors.secondary}>
            {index === selectedIndex ? '> ' : '  '}
            {item.key}
          </Text>
          <Text color={theme.colors.secondary}> - {item.description}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color={theme.colors.secondary}>Use arrow keys to navigate, Enter to select, Esc to close</Text>
      </Box>
    </Box>
  );
};

export default DropdownMenu;
