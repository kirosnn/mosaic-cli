import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, getPackageVersion, getTheme, getThemeNames, updateConfig } from '../config/index.js';
import { shortcuts, commands } from '../config/shortcuts.js';
import { Orchestrator, universalAgent, allTools } from '../orchestrator/index.js';
import { ToolExecution, MessageWithTools } from '../types/toolExecution.js';
import ChatHeader from './ChatHeader.js';
import MessageList from './MessageList.js';
import ChatInput from './ChatInput.js';
import DropdownMenu from './DropdownMenu.js';
import GlowingText from './GlowingText.js';
import ToolExecutionList from './ToolExecutionList.js';
import ToolApprovalPrompt from './ToolApprovalPrompt.js';
import LoadingStatus from './LoadingStatus.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useToolApproval } from '../hooks/useToolApproval.js';
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
  const [verboseMode, setVerboseMode] = useState<boolean>(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const executingCommand = useRef(false);
  const verboseLogger = useRef(new VerboseLogger(false));
  const streamingIndex = useRef<number | null>(null);
  const isStreaming = useRef<boolean>(false);

  const { pendingApproval, wrapToolExecution } = useToolApproval({
    onToolStart: (tool) => {
      setCurrentToolExecutions(prev => [...prev, tool]);
    },
    onToolComplete: (tool) => {
      setCurrentToolExecutions(prev => {
        const index = prev.findIndex(t => t.name === tool.name && t.status === 'running');
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = tool;
          return updated;
        }
        return prev;
      });
    }
  });

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

      if (event.type === 'ai_stream_start') {
        isStreaming.current = true;
        if (streamingIndex.current === null) {
          setMessages(prev => {
            const idx = prev.length;
            streamingIndex.current = idx;
            return [...prev, { role: 'assistant', content: '' }];
          });
        } else {
          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            if (updated[idx] && updated[idx].role === 'assistant') {
              updated[idx] = { role: 'assistant', content: '' };
            }
            return updated;
          });
        }
      } else if (event.type === 'ai_stream_delta') {
        const delta = typeof event.data?.delta === 'string' ? event.data.delta : '';
        if (delta.length === 0) return;
        if (streamingIndex.current === null) return;

        setMessages(prev => {
          const updated = [...prev];
          const idx = streamingIndex.current!;
          const msg = updated[idx];
          if (msg && msg.role === 'assistant') {
            updated[idx] = { ...msg, content: (msg.content || '') + delta } as any;
          }
          return updated;
        });
        setTokenCount(prev => prev + estimateTokens(delta));
      } else if (event.type === 'ai_stream_error') {
        isStreaming.current = false;
      } else if (event.type === 'final_response') {
        isStreaming.current = false;
      }
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

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

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
      setTokenCount(0);
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
      setMessages(prev => [...prev, userMessage]);
      setTokenCount(estimateTokens(trimmedValue));
      setIsLoading(true);
      setInput('');
      resetExitState();

      const userTokens = estimateTokens(trimmedValue);
      setTokenCount(prev => prev + userTokens);

      if (!orchestrator) {
        const errorMessage: MessageWithTools = {
          role: 'assistant',
          content: 'Error: AI orchestrator not initialized properly'
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setCurrentToolExecutions([]);

      try {
        const toolRegistry = orchestrator.getToolRegistry();
        const originalExecute = toolRegistry.execute.bind(toolRegistry);
        const executedTools: ToolExecution[] = [];

        toolRegistry.execute = wrapToolExecution(originalExecute, executedTools);

        const result = await orchestrator.executeTaskWithPlanning(value.trim());

        toolRegistry.execute = originalExecute;

        const capturedStreamingIndex = streamingIndex.current;

        setMessages(prev => {
          if (capturedStreamingIndex !== null && capturedStreamingIndex < prev.length) {
            const updated = [...prev];
            const idx = capturedStreamingIndex;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant') {
              updated[idx] = {
                ...msg,
                content: result.response,
                toolExecutions: executedTools.length > 0 ? [...executedTools] : undefined
              } as MessageWithTools;
            }
            return updated;
          }

          const fallbackAssistant: MessageWithTools = {
            role: 'assistant',
            content: result.response,
            toolExecutions: executedTools.length > 0 ? [...executedTools] : undefined
          };
          return [...prev, fallbackAssistant];
        });
        setCurrentToolExecutions([]);

      } catch (error) {
        const executedTools: ToolExecution[] = currentToolExecutions.length > 0
          ? [...currentToolExecutions]
          : [];

        const capturedStreamingIndex = streamingIndex.current;
        const errorText = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;

        setMessages(prev => {
          if (capturedStreamingIndex !== null && capturedStreamingIndex < prev.length) {
            const updated = [...prev];
            const idx = capturedStreamingIndex;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant') {
              updated[idx] = {
                ...msg,
                content: msg.content || errorText,
                toolExecutions: executedTools.length > 0 ? executedTools : undefined
              } as MessageWithTools;
            }
            return updated;
          }

          const errorMessage: MessageWithTools = {
            role: 'assistant',
            content: errorText,
            toolExecutions: executedTools.length > 0 ? executedTools : undefined
          };
          return [...prev, errorMessage];
        });
        setCurrentToolExecutions([]);
      } finally {
        setIsLoading(false);
        streamingIndex.current = null;
        isStreaming.current = false;
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
          <LoadingStatus theme={theme} tokenCount={tokenCount} />
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
