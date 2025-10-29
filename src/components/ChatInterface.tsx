import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, getPackageVersion, getTheme, getThemeNames, updateConfig } from '../config/index.js';
import { shortcuts, commands } from '../config/shortcuts.js';
import { Orchestrator, universalAgent, allTools } from '../orchestrator/index.js';
import { ToolExecution, MessageWithTools } from '../types/toolExecution.js';
import { ToolApprovalRequest, needsApproval } from '../types/toolApproval.js';
import { formatToolName, formatToolResult, formatToolParameters } from '../utils/toolFormatters.js';
import { generateToolPreview } from '../utils/diffFormatter.js';
import ChatHeader from './ChatHeader.js';
import MessageList from './MessageList.js';
import ChatInput from './ChatInput.js';
import DropdownMenu from './DropdownMenu.js';
import GlowingText from './GlowingText.js';
import ToolExecutionList from './ToolExecutionList.js';
import ToolApprovalPrompt from './ToolApprovalPrompt.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { historyService } from '../services/historyService.js';
import { VerboseLogger } from '../utils/VerboseLogger.js';

const version = getPackageVersion();

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
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | null>(null);
  const [verboseMode, setVerboseMode] = useState<boolean>(false);
  const executingCommand = useRef(false);
  const verboseLogger = useRef(new VerboseLogger(false));

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

    orch.on((event) => {
      verboseLogger.current.log(event);
    });

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

  useInput((inputChar, key) => {
    if (pendingApproval) {
      if (inputChar === 'y' || inputChar === 'Y') {
        pendingApproval.onApprove();
        setPendingApproval(null);
      } else if (inputChar === 'n' || inputChar === 'N' || key.escape) {
        pendingApproval.onReject();
        setPendingApproval(null);
      }
    }
  });

  const handleCommandExecution = (action: string) => {
    executingCommand.current = true;

    if (action === 'theme') {
      setShowThemeSelector(true);
      setSelectedIndex(0);
    } else if (action === 'verbose') {
      const newVerboseMode = !verboseMode;
      setVerboseMode(newVerboseMode);
      verboseLogger.current.setEnabled(newVerboseMode);

      const statusMessage: MessageWithTools = {
        role: 'assistant',
        content: `Verbose mode ${newVerboseMode ? 'enabled' : 'disabled'}. ${newVerboseMode ? 'You will now see detailed execution logs in the terminal.' : ''}`
      };
      setMessages([...messages, statusMessage]);
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

          const newTool: ToolExecution = {
            name: toolName,
            displayName: displayName,
            status: 'running',
            parameters: parameters
          };

          executedTools.push(newTool);
          setCurrentToolExecutions([...executedTools]);

          if (needsApproval(toolName)) {
            const preview = await generateToolPreview(toolName, parameters);

            const approved = await new Promise<boolean>((resolve) => {
              const approvalRequest: ToolApprovalRequest = {
                toolName,
                parameters,
                preview,
                onApprove: () => resolve(true),
                onReject: () => resolve(false)
              };
              setPendingApproval(approvalRequest);
            });

            if (!approved) {
              const toolIndex = executedTools.findIndex(
                tool => tool.name === toolName && tool.status === 'running'
              );

              if (toolIndex !== -1) {
                executedTools[toolIndex] = {
                  ...executedTools[toolIndex],
                  status: 'error',
                  result: 'Rejected by user'
                };
                setCurrentToolExecutions([...executedTools]);
              }

              return {
                success: false,
                error: 'Tool execution rejected by user'
              };
            }
          }

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
                    <ToolExecutionList tools={msg.toolExecutions} theme={theme} />
                  </Box>
                )}
                <Box paddingLeft={2}>
                  <Text color={theme.colors.text}>● </Text>
                  <Text color={theme.colors.text}>{msg.content}</Text>
                </Box>
              </>
            )}
          </Box>
        ))}

        {currentToolExecutions.length > 0 && (
          <Box marginBottom={1} flexDirection="column" paddingLeft={2}>
            <ToolExecutionList tools={currentToolExecutions} theme={theme} />
          </Box>
        )}

        {pendingApproval && (
          <ToolApprovalPrompt
            toolName={pendingApproval.toolName}
            preview={pendingApproval.preview}
            theme={theme}
          />
        )}

        {isLoading && currentToolExecutions.length === 0 && !pendingApproval && (
          <Box marginBottom={1} paddingLeft={2}>
            <GlowingText theme={theme} text="Agent is thinking and planning..." />
          </Box>
        )}
      </Box>

      {!pendingApproval && (
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
      )}

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
