import { useRef } from 'react';
import { useInput, useApp } from 'ink';

interface UseKeyboardShortcutsProps {
  input: string;
  showShortcuts: boolean;
  showCommands: boolean;
  showThemeSelector?: boolean;
  showProviderSelector?: boolean;
  showModelSelector?: boolean;
  showUndoSelector?: boolean;
  showIdeSelector?: boolean;
  showApiKeyProviderSelector?: boolean;
  selectedIndex: number;
  shortcuts: any[];
  commands: any[];
  filteredShortcuts?: any[];
  filteredCommands?: any[];
  themeNames?: string[];
  providerNames?: any[];
  availableModels?: Array<{ key: string; description: string; isHistory?: boolean; isSeparator?: boolean; isCustom?: boolean }>;
  userMessages?: any[];
  detectedIDEs?: any[];
  isStreaming?: boolean;
  onClearMessages: () => void;
  onClearInput: () => void;
  onShowShortcuts: (show: boolean) => void;
  onShowCommands: (show: boolean) => void;
  onShowThemeSelector?: (show: boolean) => void;
  onShowProviderSelector?: (show: boolean) => void;
  onShowModelSelector?: (show: boolean) => void;
  onShowUndoSelector?: (show: boolean) => void;
  onShowIdeSelector?: (show: boolean) => void;
  onShowApiKeyProviderSelector?: (show: boolean) => void;
  onSelectIndex: (index: number) => void;
  onSelectItem: (item: string) => void;
  onShowCtrlCMessage: (show: boolean) => void;
  onStopStreaming?: () => void;
  onExecuteCommand?: (action: string) => void;
  onExecuteShortcut?: (action: string) => void;
  onSelectTheme?: (themeName: string) => void;
  onSelectProvider?: (providerType: string) => void;
  onSelectModel?: (model: string) => void;
  onSelectUndo?: (messageIndex: number) => void;
  onSelectIde?: (index: number) => void;
  onSelectApiKeyProvider?: (providerType: string) => void;
}

export const useKeyboardShortcuts = ({
  input,
  showShortcuts,
  showCommands,
  showThemeSelector = false,
  showProviderSelector = false,
  showModelSelector = false,
  showUndoSelector = false,
  showIdeSelector = false,
  showApiKeyProviderSelector = false,
  selectedIndex,
  shortcuts,
  commands,
  filteredShortcuts = [],
  filteredCommands = [],
  themeNames = [],
  providerNames = [],
  availableModels = [],
  userMessages = [],
  detectedIDEs = [],
  isStreaming = false,
  onClearMessages,
  onClearInput,
  onShowShortcuts,
  onShowCommands,
  onShowThemeSelector,
  onShowProviderSelector,
  onShowModelSelector,
  onShowUndoSelector,
  onShowIdeSelector,
  onShowApiKeyProviderSelector,
  onSelectIndex,
  onSelectItem,
  onShowCtrlCMessage,
  onStopStreaming,
  onExecuteCommand,
  onExecuteShortcut,
  onSelectTheme,
  onSelectProvider,
  onSelectModel,
  onSelectUndo,
  onSelectIde,
  onSelectApiKeyProvider
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

    if (key.escape && isStreaming && onStopStreaming) {
      onStopStreaming();
      return;
    }

    if (showShortcuts || showCommands || showThemeSelector || showProviderSelector || showModelSelector || showUndoSelector || showIdeSelector || showApiKeyProviderSelector) {
      let items: any[] = [];

      if (showShortcuts) {
        items = filteredShortcuts.length > 0 ? filteredShortcuts : shortcuts;
      } else if (showCommands) {
        items = filteredCommands.length > 0 ? filteredCommands : commands;
      } else if (showThemeSelector) {
        items = themeNames.map(name => ({ key: name, description: `Switch to ${name} theme` }));
      } else if (showProviderSelector || showApiKeyProviderSelector) {
        items = providerNames.map(p => ({ key: p.type, description: p.name }));
      } else if (showModelSelector) {
        items = availableModels;
      } else if (showUndoSelector) {
        items = userMessages.filter(m => m.msg.role === 'user');
      } else if (showIdeSelector) {
        items = detectedIDEs;
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
        } else if (showApiKeyProviderSelector && onSelectApiKeyProvider) {
          onSelectApiKeyProvider((items[selectedIndex] as any).key);
          if (onShowApiKeyProviderSelector) {
            onShowApiKeyProviderSelector(false);
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
        } else if (showUndoSelector && onSelectUndo) {
          const selectedItem = items[selectedIndex];
          if (selectedItem && selectedItem.originalIndex !== undefined) {
            onSelectUndo(selectedItem.originalIndex);
          }
          if (onShowUndoSelector) {
            onShowUndoSelector(false);
          }
          onSelectIndex(0);
          onClearInput();
        } else if (showIdeSelector && onSelectIde) {
          onSelectIde(selectedIndex);
          if (onShowIdeSelector) {
            onShowIdeSelector(false);
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
        if (onShowApiKeyProviderSelector) {
          onShowApiKeyProviderSelector(false);
        }
        if (onShowModelSelector) {
          onShowModelSelector(false);
        }
        if (onShowUndoSelector) {
          onShowUndoSelector(false);
        }
        if (onShowIdeSelector) {
          onShowIdeSelector(false);
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
