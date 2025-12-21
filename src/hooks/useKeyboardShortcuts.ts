import { useRef } from 'react';
import { useInput, useApp } from 'ink';

interface UseKeyboardShortcutsProps {
  input: string;
  showShortcuts: boolean;
  showCommands: boolean;
  showThemeSelector?: boolean;
  selectedIndex: number;
  shortcuts: any[];
  commands: any[];
  filteredShortcuts?: any[];
  filteredCommands?: any[];
  themeNames?: string[];
  onClearMessages: () => void;
  onClearInput: () => void;
  onShowShortcuts: (show: boolean) => void;
  onShowCommands: (show: boolean) => void;
  onShowThemeSelector?: (show: boolean) => void;
  onSelectIndex: (index: number) => void;
  onSelectItem: (item: string) => void;
  onShowCtrlCMessage: (show: boolean) => void;
  onExecuteCommand?: (action: string) => void;
  onExecuteShortcut?: (action: string) => void;
  onSelectTheme?: (themeName: string) => void;
}

export const useKeyboardShortcuts = ({
  input,
  showShortcuts,
  showCommands,
  showThemeSelector = false,
  selectedIndex,
  shortcuts,
  commands,
  filteredShortcuts = [],
  filteredCommands = [],
  themeNames = [],
  onClearMessages,
  onClearInput,
  onShowShortcuts,
  onShowCommands,
  onShowThemeSelector,
  onSelectIndex,
  onSelectItem,
  onShowCtrlCMessage,
  onExecuteCommand,
  onExecuteShortcut,
  onSelectTheme
}: UseKeyboardShortcutsProps) => {
  const { exit } = useApp();
  const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const waitingForSecondCtrlC = useRef(false);

  const resetExitState = () => {
    waitingForSecondCtrlC.current = false;
    onShowCtrlCMessage(false);
    if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
  };

  useInput((inputChar, key) => {
    if (key.ctrl && inputChar === 'c') {
      if (waitingForSecondCtrlC.current) {
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        exit();
      } else {
        waitingForSecondCtrlC.current = true;
        onShowCtrlCMessage(true);
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = setTimeout(() => {
          waitingForSecondCtrlC.current = false;
          onShowCtrlCMessage(false);
        }, 3000);
      }
      return;
    }

    if (showShortcuts || showCommands || showThemeSelector) {
      let items: any[] = [];

      if (showShortcuts) {
        items = filteredShortcuts.length > 0 ? filteredShortcuts : shortcuts;
      } else if (showCommands) {
        items = filteredCommands.length > 0 ? filteredCommands : commands;
      } else if (showThemeSelector) {
        items = themeNames.map(name => ({ key: name, description: `Switch to ${name} theme` }));
      }

      if (key.downArrow) {
        onSelectIndex((selectedIndex + 1) % items.length);
      } else if (key.upArrow) {
        onSelectIndex((selectedIndex - 1 + items.length) % items.length);
      } else if (key.return) {
        if (showShortcuts && onExecuteShortcut) {
          const searchTerm = input.startsWith('?') ? input.slice(1) : '';
          const exactMatch = shortcuts.find(sc => sc.key.toLowerCase() === searchTerm.toLowerCase());

          if (exactMatch) {
            onExecuteShortcut(exactMatch.action);
            onShowShortcuts(false);
            onShowCommands(false);
            onSelectIndex(0);
            onClearInput();
          } else {
            const selected = items[selectedIndex];
            if (selected) {
              const shortcutKey = (selected as any).key;
              onSelectItem('?' + shortcutKey);

              const autocompletedMatch = shortcuts.find(sc => sc.key === shortcutKey);
              if (autocompletedMatch) {
                onShowShortcuts(false);
                onShowCommands(false);
                onSelectIndex(0);
              }
            }
          }
        } else if (showCommands && onExecuteCommand) {
          const exactMatch = commands.find(cmd => cmd.name === input);

          if (exactMatch) {
            onExecuteCommand(exactMatch.action);
            onShowShortcuts(false);
            onShowCommands(false);
            onSelectIndex(0);
            onClearInput();
          } else {
            const selected = items[selectedIndex];
            if (selected) {
              const commandName = (selected as any).name;
              onSelectItem(commandName);

              const autocompletedMatch = commands.find(cmd => cmd.name === commandName);
              if (autocompletedMatch) {
                onShowShortcuts(false);
                onShowCommands(false);
                onSelectIndex(0);
              }
            }
          }
        } else if (showThemeSelector && onSelectTheme) {
          onSelectTheme((items[selectedIndex] as any).key);
          if (onShowThemeSelector) {
            onShowThemeSelector(false);
          }
          onSelectIndex(0);
          onClearInput();
        }
      } else if (key.escape) {
        onShowShortcuts(false);
        onShowCommands(false);
        if (onShowThemeSelector) {
          onShowThemeSelector(false);
        }
        onSelectIndex(0);
      }
      return;
    }

    if (key.ctrl && inputChar === 'l') {
      onClearMessages();
      return;
    }

    if (key.ctrl && inputChar === 'u') {
      onClearInput();
      return;
    }

    if (inputChar === '?' && input === '') {
      onShowShortcuts(true);
      onSelectIndex(0);
      return;
    }

    if (inputChar === '/' && input === '') {
      onShowCommands(true);
      onSelectIndex(0);
      return;
    }
  });

  return { resetExitState };
};
