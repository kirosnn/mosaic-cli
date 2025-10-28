import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { loadConfig, getPackageVersion, getTheme } from '../config/index.js';
import { shortcuts, commands } from '../config/shortcuts.js';
import { AIProvider, Message } from '../services/aiProvider.js';
import ChatHeader from './ChatHeader.js';
import MessageList from './MessageList.js';
import ChatInput from './ChatInput.js';
import DropdownMenu from './DropdownMenu.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

const version = getPackageVersion();

const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 80);
  const [showCtrlCMessage, setShowCtrlCMessage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const config = loadConfig();
  const provider = config.provider;
  const currentDir = process.cwd();
  const theme = getTheme(config.theme || 'default');

  const aiProvider = provider ? new AIProvider(provider) : null;

  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(process.stdout.columns || 80);
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (showShortcuts && !input.startsWith('?')) {
      setShowShortcuts(false);
      setSelectedIndex(0);
    }
    if (showCommands && !input.startsWith('/')) {
      setShowCommands(false);
      setSelectedIndex(0);
    }
  }, [input, showShortcuts, showCommands]);

  const { resetExitState } = useKeyboardShortcuts({
    input,
    showShortcuts,
    showCommands,
    selectedIndex,
    shortcuts,
    commands,
    onClearMessages: () => setMessages([]),
    onClearInput: () => setInput(''),
    onShowShortcuts: setShowShortcuts,
    onShowCommands: setShowCommands,
    onSelectIndex: setSelectedIndex,
    onSelectItem: setInput,
    onShowCtrlCMessage: setShowCtrlCMessage
  });

  const handleSubmit = async (value: string) => {
    if (value.trim() && !isLoading) {
      const userMessage: Message = { role: 'user', content: value.trim() };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput('');
      resetExitState();

      if (!aiProvider) {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Error: AI provider not configured properly'
        };
        setMessages([...newMessages, errorMessage]);
        return;
      }

      setIsLoading(true);

      try {
        const response = await aiProvider.sendMessage(newMessages);

        if (response.error) {
          const errorMessage: Message = {
            role: 'assistant',
            content: `Error: ${response.error}`
          };
          setMessages([...newMessages, errorMessage]);
        } else {
          const assistantMessage: Message = {
            role: 'assistant',
            content: response.content
          };
          setMessages([...newMessages, assistantMessage]);
        }
      } catch (error) {
        const errorMessage: Message = {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        };
        setMessages([...newMessages, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (showCtrlCMessage) {
      resetExitState();
    }
  };

  const getHelpText = () => {
    if (showCtrlCMessage) {
      return 'Press Ctrl+C again to exit';
    }
    if (input === '') {
      return '/ for commands';
    }
    if (input.startsWith('?')) {
      return '? for shortcuts';
    }
    return '';
  };

  const helpText = getHelpText();

  return (
    <Box flexDirection="column">
      <ChatHeader
        version={version}
        provider={provider}
        currentDir={currentDir}
        theme={theme}
      />

      <Box marginTop={1} paddingX={2} flexDirection="column">
        <MessageList messages={messages} theme={theme} />
        {isLoading && (
          <Box marginBottom={1}>
            <Text color={theme.colors.accent}>Assistant is thinking...</Text>
          </Box>
        )}
      </Box>

      <ChatInput
        input={input}
        terminalWidth={terminalWidth}
        helpText={helpText}
        theme={theme}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />

      {showShortcuts && (
        <DropdownMenu
          items={shortcuts.map(s => ({ key: s.key, description: s.description }))}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Keyboard Shortcuts"
        />
      )}

      {showCommands && (
        <DropdownMenu
          items={commands.map(c => ({ key: c.name, description: c.description }))}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Available Commands"
        />
      )}
    </Box>
  );
};

export default ChatInterface;
