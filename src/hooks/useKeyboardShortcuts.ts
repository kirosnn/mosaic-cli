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
        process.stdout.write('\x1b[2J\x1b[0f');
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
        items = shortcuts;
      } else if (showCommands) {
        items = commands;
      } else if (showThemeSelector) {
        items = themeNames.map(name => ({ key: name, description: `Switch to ${name} theme` }));
      }

      if (key.downArrow) {
        onSelectIndex((selectedIndex + 1) % items.length);
      } else if (key.upArrow) {
        onSelectIndex((selectedIndex - 1 + items.length) % items.length);
      } else if (key.return) {
        const selected = items[selectedIndex];

        if (showCommands && onExecuteCommand) {
          onExecuteCommand((selected as any).action);
          onShowShortcuts(false);
          onShowCommands(false);
        } else if (showThemeSelector && onSelectTheme) {
          onSelectTheme((selected as any).key);
          if (onShowThemeSelector) {
            onShowThemeSelector(false);
          }
        } else if (showShortcuts) {
          onShowShortcuts(false);
        }

        onSelectIndex(0);
        onClearInput();
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
