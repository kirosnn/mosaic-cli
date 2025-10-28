import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text } from 'ink';
import { loadConfig, getPackageVersion, getTheme, getThemeNames, updateConfig } from '../config/index.js';
import { shortcuts, commands } from '../config/shortcuts.js';
import { Message } from '../services/aiProvider.js';
import { Orchestrator, universalAgent, allTools } from '../orchestrator/index.js';
import ChatHeader from './ChatHeader.js';
import MessageList from './MessageList.js';
import ChatInput from './ChatInput.js';
import DropdownMenu from './DropdownMenu.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { historyService } from '../services/historyService.js';

const version = getPackageVersion();

interface ToolExecution {
  name: string;
  displayName: string;
  status: 'running' | 'completed' | 'error';
  result?: string;
  parameters?: Record<string, any>;
}

interface MessageWithTools extends Message {
  toolExecutions?: ToolExecution[];
}

const formatToolName = (toolName: string): string => {
  const nameMap: Record<string, string> = {
    'read_file': 'Read',
    'write_file': 'Write',
    'list_directory': 'List',
    'create_directory': 'CreateDir',
    'delete_file': 'Delete',
    'file_exists': 'FileExists',
    'execute_shell': 'Shell',
    'execute_node': 'Node',
    'search_code': 'Search',
    'install_package': 'Install'
  };

  return nameMap[toolName] || toolName;
};

  const formatToolResult = (toolName: string, result: any, parameters?: Record<string, any>): string => {
    if (!result) return '';

    try {
      const data = typeof result === 'string' ? JSON.parse(result) : result;

      switch (toolName) {
      case 'read_file':
        if (data.content) {
          const lines = data.content.split('\n').length;
          return `Read ${lines} lines`;
        }
        break;
      case 'write_file':
        if (data.bytesWritten) {
          return `Wrote ${data.lines} lines`;
        }
        break;
      case 'list_directory':
        if (data.entries) {
          return `Found ${data.entries.length} items`;
        }
        break;
      case 'execute_shell':
        {
          const stdout = (data.stdout ?? '').trim();
          const stderr = (data.stderr ?? '').trim();
          const preferred = stdout || stderr;

          if (preferred) {
            return preferred.length > 50 ? preferred.substring(0, 47) + '...' : preferred;
          }
          if (data.output) {
            const output = String(data.output).trim();
            return output.length > 50 ? output.substring(0, 47) + '...' : output;
          }
          break;
        }
      case 'search_code':
        if (data.count !== undefined) {
          return `Found ${data.count} matches`;
        }
        break;
      case 'install_package':
        if (data.package) {
          return `Installed ${data.package}`;
        }
        break;
    }

    if (typeof data === 'object') {
      const str = JSON.stringify(data);
      return str.length > 50 ? str.substring(0, 50) + '...' : str;
    }

    return String(data);
  } catch {
    return String(result).substring(0, 50);
  }
};

const formatToolParameters = (toolName: string, parameters?: Record<string, any>): string => {
  if (!parameters) return '';

  switch (toolName) {
    case 'read_file':
    case 'write_file':
    case 'delete_file':
      return parameters.path || '';
    case 'list_directory':
      return parameters.path || '.';
    case 'execute_shell':
      return parameters.command || '';
    case 'search_code':
      return parameters.pattern || '';
    case 'install_package':
      return parameters.package || '';
    default:
      return '';
  }
};

const GlowingText = ({ text, theme }: { text: string; theme: any }) => {
  const [frame, setFrame] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % text.length);
    }, 120);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <Text>
      {text.split('').map((char, i) => {
        const distance = Math.abs(frame - i);
        const glowLevel = distance === 0 ? theme.colors.accent
          : distance === 1 ? theme.colors.text
            : theme.colors.secondary;
        return (
          <Text key={i} color={glowLevel}>
            {char}
          </Text>
        );
      })}
    </Text>
  );
};

const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageWithTools[]>([]);
  const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 80);
  const [showCtrlCMessage, setShowCtrlCMessage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolExecutions, setCurrentToolExecutions] = useState<ToolExecution[]>([]);
  const [currentThemeName, setCurrentThemeName] = useState<string>('default');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const executingCommand = useRef(false);

  const config = loadConfig();
  const provider = config.provider;
  const currentDir = process.cwd();
  const theme = getTheme(currentThemeName);
  const themeNames = getThemeNames();

  useEffect(() => {
    const loadedConfig = loadConfig();
    setCurrentThemeName(loadedConfig.theme || 'default');
  }, []);

  const orchestrator = useMemo(() => {
    if (!provider) return null;

    const orch = new Orchestrator(provider, {
      maxIterations: 10,
      enableToolChaining: true,
      toolTimeout: 30000,
      defaultAgent: 'universal_agent'
    });

    orch.registerAgent(universalAgent);
    allTools.forEach(tool => orch.registerTool(tool));

    return orch;
  }, []);

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
    if (executingCommand.current) {
      return;
    }

    if (showShortcuts && !input.startsWith('?')) {
      setShowShortcuts(false);
      setSelectedIndex(0);
    }
    if (showCommands && !input.startsWith('/')) {
      setShowCommands(false);
      setSelectedIndex(0);
    }
  }, [input, showShortcuts, showCommands]);

  const handleCommandExecution = (action: string) => {
    executingCommand.current = true;

    if (action === 'theme') {
      setShowThemeSelector(true);
      setSelectedIndex(0);
    }

    setTimeout(() => {
      executingCommand.current = false;
    }, 100);
  };

  const handleThemeSelection = (themeName: string) => {
    setCurrentThemeName(themeName);
    updateConfig({ theme: themeName });
    setShowThemeSelector(false);
    setSelectedIndex(0);
  };

  const { resetExitState } = useKeyboardShortcuts({
    input,
    showShortcuts,
    showCommands,
    showThemeSelector,
    selectedIndex,
    shortcuts,
    commands,
    themeNames,
    onClearMessages: () => {
      setMessages([]);
      if (orchestrator) {
        orchestrator.resetContext();
      }
    },
    onClearInput: () => setInput(''),
    onShowShortcuts: setShowShortcuts,
    onShowCommands: setShowCommands,
    onShowThemeSelector: setShowThemeSelector,
    onSelectIndex: setSelectedIndex,
    onSelectItem: setInput,
    onShowCtrlCMessage: setShowCtrlCMessage,
    onExecuteCommand: handleCommandExecution,
    onSelectTheme: handleThemeSelection
  });

  const handleSubmit = async (value: string) => {
    if (value.trim() && !isLoading) {
      const trimmedValue = value.trim();
      historyService.addEntry(trimmedValue);
      setHistoryIndex(-1);

      const userMessage: MessageWithTools = { role: 'user', content: trimmedValue };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput('');
      resetExitState();

      if (!orchestrator) {
        const errorMessage: MessageWithTools = {
          role: 'assistant',
          content: 'Error: AI orchestrator not initialized properly'
        };
        setMessages([...newMessages, errorMessage]);
        return;
      }

      setIsLoading(true);
      setCurrentToolExecutions([]);

      try {
        const toolRegistry = orchestrator.getToolRegistry();
        const originalExecute = toolRegistry.execute.bind(toolRegistry);
        const executedTools: ToolExecution[] = [];

        toolRegistry.execute = async (toolName: string, parameters: Record<string, any>, context: any, timeout?: number) => {
          const displayName = formatToolName(toolName);
          const paramDisplay = formatToolParameters(toolName, parameters);

          const newTool: ToolExecution = {
            name: toolName,
            displayName: displayName,
            status: 'running',
            parameters: parameters
          };

          executedTools.push(newTool);

          setCurrentToolExecutions([...executedTools]);

          const result = await originalExecute(toolName, parameters, context, timeout);

          const toolIndex = executedTools.findIndex(
            tool => tool.name === toolName && tool.status === 'running'
          );

          if (toolIndex !== -1) {
            executedTools[toolIndex] = {
              ...executedTools[toolIndex],
              status: result.success ? 'completed' : 'error',
              result: formatToolResult(toolName, result.data || result.error, parameters)
            };
            setCurrentToolExecutions([...executedTools]);
          }

          return result;
        };

        const result = await orchestrator.executeTaskWithPlanning(value.trim());

        toolRegistry.execute = originalExecute;

        const assistantMessage: MessageWithTools = {
          role: 'assistant',
          content: result.response,
          toolExecutions: executedTools.length > 0 ? [...executedTools] : undefined
        };
        setMessages([...newMessages, assistantMessage]);
        setCurrentToolExecutions([]);

      } catch (error) {
        const toolRegistry = orchestrator.getToolRegistry();
        const executedTools: ToolExecution[] = currentToolExecutions.length > 0
          ? [...currentToolExecutions]
          : [];

        const errorMessage: MessageWithTools = {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          toolExecutions: executedTools.length > 0 ? executedTools : undefined
        };
        setMessages([...newMessages, errorMessage]);
        setCurrentToolExecutions([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    setHistoryIndex(-1);
    if (showCtrlCMessage) {
      resetExitState();
    }
  };

  const handleHistoryNavigation = (direction: 'up' | 'down') => {
    const historySize = historyService.getSize();
    if (historySize === 0) return;

    let newIndex = historyIndex;

    if (direction === 'up') {
      if (historyIndex === -1) {
        newIndex = historySize - 1;
      } else if (historyIndex > 0) {
        newIndex = historyIndex - 1;
      }
    } else {
      if (historyIndex < historySize - 1) {
        newIndex = historyIndex + 1;
      } else {
        newIndex = -1;
        setInput('');
        setHistoryIndex(newIndex);
        return;
      }
    }

    const entry = historyService.getEntry(newIndex);
    if (entry !== undefined) {
      setInput(entry);
      setHistoryIndex(newIndex);
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

  const renderToolExecutions = (tools: ToolExecution[]) => {
    return tools.map((tool, index) => (
      <Box key={index} flexDirection="column" marginBottom={0}>
        <Box>
          <Text color={theme.colors.accent}>● </Text>
          <Text color={theme.colors.text}>
            {tool.displayName}
            {tool.parameters && formatToolParameters(tool.name, tool.parameters) &&
              `(${formatToolParameters(tool.name, tool.parameters)})`}
          </Text>
          {tool.status === 'running' && (
            <Text color={theme.colors.secondary}> (running...)</Text>
          )}
        </Box>
        {tool.status === 'completed' && tool.result && (
          <Box paddingLeft={2}>
            <Text color={theme.colors.secondary}>⎿ </Text>
            <Text color={theme.colors.secondary}>{tool.result}</Text>
          </Box>
        )}
        {tool.status === 'error' && (
          <Box paddingLeft={2}>
            <Text color={theme.colors.secondary}>⎿ </Text>
            <Text color={theme.colors.error}>Error</Text>
          </Box>
        )}
      </Box>
    ));
  };

  return (
    <Box flexDirection="column">
      <ChatHeader
        version={version}
        provider={provider}
        currentDir={currentDir}
        theme={theme}
      />

      <Box marginTop={1} paddingX={2} flexDirection="column">
        {messages.map((msg, index) => (
          <Box key={index} marginBottom={1} flexDirection="column">
            {msg.role === 'user' ? (
              <Text color={theme.colors.text}>{msg.content}</Text>
            ) : (
              <>
                {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                  <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
                    {renderToolExecutions(msg.toolExecutions)}
                  </Box>
                )}
                <Box paddingLeft={2}>
                  <Text color={theme.colors.accent}>● </Text>
                  <Text color={theme.colors.text}>{msg.content}</Text>
                </Box>
              </>
            )}
          </Box>
        ))}

        {currentToolExecutions.length > 0 && (
          <Box marginBottom={1} flexDirection="column" paddingLeft={2}>
            {renderToolExecutions(currentToolExecutions)}
          </Box>
        )}

        {isLoading && currentToolExecutions.length === 0 && (
          <Box marginBottom={1} paddingLeft={2}>
            <GlowingText theme={theme} text="Agent is thinking and planning..." />
          </Box>
        )}
      </Box>

      <ChatInput
        input={input}
        terminalWidth={terminalWidth}
        helpText={helpText}
        theme={theme}
        isMenuOpen={showShortcuts || showCommands || showThemeSelector}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onHistoryNavigation={handleHistoryNavigation}
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

      {showThemeSelector && (
        <DropdownMenu
          items={themeNames.map(name => ({ key: name, description: `Switch to ${name} theme` }))}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Select Theme"
        />
      )}
    </Box>
  );
};

export default ChatInterface;
