import { useRef } from 'react';
import { useInput, useApp } from 'ink';

interface UseKeyboardShortcutsProps {
  input: string;
  showShortcuts: boolean;
  showCommands: boolean;
  showThemeSelector?: boolean;
  showProviderSelector?: boolean;
  showModelSelector?: boolean;
  showRewindSelector?: boolean;
  selectedIndex: number;
  shortcuts: any[];
  commands: any[];
  filteredShortcuts?: any[];
  filteredCommands?: any[];
  themeNames?: string[];
  providerNames?: any[];
  availableModels?: Array<{ key: string; description: string; isHistory?: boolean; isSeparator?: boolean; isCustom?: boolean }>;
  userMessages?: any[];
  onClearMessages: () => void;
  onClearInput: () => void;
  onShowShortcuts: (show: boolean) => void;
  onShowCommands: (show: boolean) => void;
  onShowThemeSelector?: (show: boolean) => void;
  onShowProviderSelector?: (show: boolean) => void;
  onShowModelSelector?: (show: boolean) => void;
  onShowRewindSelector?: (show: boolean) => void;
  onSelectIndex: (index: number) => void;
  onSelectItem: (item: string) => void;
  onShowCtrlCMessage: (show: boolean) => void;
  onExecuteCommand?: (action: string) => void;
  onExecuteShortcut?: (action: string) => void;
  onSelectTheme?: (themeName: string) => void;
  onSelectProvider?: (providerType: string) => void;
  onSelectModel?: (model: string) => void;
  onSelectRewind?: (messageIndex: number) => void;
}

export const useKeyboardShortcuts = ({
  input,
  showShortcuts,
  showCommands,
  showThemeSelector = false,
  showProviderSelector = false,
  showModelSelector = false,
  showRewindSelector = false,
  selectedIndex,
  shortcuts,
  commands,
  filteredShortcuts = [],
  filteredCommands = [],
  themeNames = [],
  providerNames = [],
  availableModels = [],
  userMessages = [],
  onClearMessages,
  onClearInput,
  onShowShortcuts,
  onShowCommands,
  onShowThemeSelector,
  onShowProviderSelector,
  onShowModelSelector,
  onShowRewindSelector,
  onSelectIndex,
  onSelectItem,
  onShowCtrlCMessage,
  onExecuteCommand,
  onExecuteShortcut,
  onSelectTheme,
  onSelectProvider,
  onSelectModel,
  onSelectRewind
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

    if (showShortcuts || showCommands || showThemeSelector || showProviderSelector || showModelSelector || showRewindSelector) {
      let items: any[] = [];

      if (showShortcuts) {
        items = filteredShortcuts.length > 0 ? filteredShortcuts : shortcuts;
      } else if (showCommands) {
        items = filteredCommands.length > 0 ? filteredCommands : commands;
      } else if (showThemeSelector) {
        items = themeNames.map(name => ({ key: name, description: `Switch to ${name} theme` }));
      } else if (showProviderSelector) {
        items = providerNames.map(p => ({ key: p.type, description: p.name }));
      } else if (showModelSelector) {
        items = availableModels;
      } else if (showRewindSelector) {
        items = userMessages.filter(m => m.msg.role === 'user');
      }

      if (key.tab && showCommands && items.length > 0) {
        const firstCommand = items[0];
        if (firstCommand) {
          onSelectItem(firstCommand.name);
        }
        return;
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
        } else if (showProviderSelector && onSelectProvider) {
          onSelectProvider((items[selectedIndex] as any).key);
          if (onShowProviderSelector) {
            onShowProviderSelector(false);
          }
          onSelectIndex(0);
          onClearInput();
        } else if (showModelSelector && onSelectModel) {
          onSelectModel((items[selectedIndex] as any).key);
          if (onShowModelSelector) {
            onShowModelSelector(false);
          }
          onSelectIndex(0);
          onClearInput();
        } else if (showRewindSelector && onSelectRewind) {
          const selectedItem = items[selectedIndex];
          if (selectedItem && selectedItem.originalIndex !== undefined) {
            onSelectRewind(selectedItem.originalIndex);
          }
          if (onShowRewindSelector) {
            onShowRewindSelector(false);
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
        if (onShowProviderSelector) {
          onShowProviderSelector(false);
        }
        if (onShowModelSelector) {
          onShowModelSelector(false);
        }
        if (onShowRewindSelector) {
          onShowRewindSelector(false);
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
