import { useRef } from 'react';
import { useInput, useApp } from 'ink';

interface UseKeyboardShortcutsProps {
  input: string;
  showShortcuts: boolean;
  showCommands: boolean;
  selectedIndex: number;
  shortcuts: any[];
  commands: any[];
  onClearMessages: () => void;
  onClearInput: () => void;
  onShowShortcuts: (show: boolean) => void;
  onShowCommands: (show: boolean) => void;
  onSelectIndex: (index: number) => void;
  onSelectItem: (item: string) => void;
  onShowCtrlCMessage: (show: boolean) => void;
}

export const useKeyboardShortcuts = ({
  input,
  showShortcuts,
  showCommands,
  selectedIndex,
  shortcuts,
  commands,
  onClearMessages,
  onClearInput,
  onShowShortcuts,
  onShowCommands,
  onSelectIndex,
  onSelectItem,
  onShowCtrlCMessage
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

    if (showShortcuts || showCommands) {
      const items = showShortcuts ? shortcuts : commands;

      if (key.downArrow) {
        onSelectIndex((selectedIndex + 1) % items.length);
      } else if (key.upArrow) {
        onSelectIndex((selectedIndex - 1 + items.length) % items.length);
      } else if (key.return) {
        const selected = items[selectedIndex];
        if (showCommands) {
          onSelectItem((selected as any).name);
        }
        onShowShortcuts(false);
        onShowCommands(false);
        onSelectIndex(0);
      } else if (key.escape) {
        onShowShortcuts(false);
        onShowCommands(false);
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
