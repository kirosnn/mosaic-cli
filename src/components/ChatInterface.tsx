import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, getPackageVersion, getTheme, getThemeNames, updateConfig, getModelHistory, addToModelHistory } from '../config/index.js';
import { shortcuts, commands } from '../config/shortcuts.js';
import { getProviderTypes, PROVIDERS, getProviderOption } from '../config/providers.js';
import { Orchestrator, universalAgent, allTools } from '../orchestrator/index.js';
import { ToolExecution, MessageWithTools } from '../types/toolExecution.js';
import { formatToolName, formatToolResult } from '../utils/toolFormatters.js';
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
import { extractTitleFromResponse, removeTitleFromContent, setTerminalTitle } from '../utils/terminalUtils.js';
import { MOSAIC_INIT_PROMPT, getMosaicFilePath } from '../utils/mosaicContext.js';

const version = getPackageVersion();

const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageWithTools[]>([]);
  const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 80);
  const [showCtrlCMessage, setShowCtrlCMessage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [isAddingCustomModel, setIsAddingCustomModel] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToolExecutions, setCurrentToolExecutions] = useState<ToolExecution[]>([]);
  const [currentThemeName, setCurrentThemeName] = useState<string>('default');
  const [currentProvider, setCurrentProvider] = useState(() => {
    const config = loadConfig();
    return config.provider;
  });
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [verboseMode, setVerboseMode] = useState<boolean>(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const executingCommand = useRef(false);
  const verboseLogger = useRef(new VerboseLogger(false));
  const streamingIndex = useRef<number | null>(null);
  const isStreaming = useRef<boolean>(false);
  const iterationCount = useRef<number>(0);
  const executionStartTime = useRef<number | null>(null);
  const executedTools = useRef<any[]>([]);
  const currentResponse = useRef<string>('');
  const currentTokenCount = useRef<number>(0);

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

  const currentDir = process.cwd();
  const theme = getTheme(currentThemeName);
  const themeNames = getThemeNames();

  const providerTypes = useMemo(() => getProviderTypes(), []);
  const providerNames = useMemo(() => providerTypes.map(type => ({
    type,
    name: PROVIDERS[type].name
  })), [providerTypes]);

  const availableModels = useMemo(() => {
    if (!currentProvider) return [];

    const models: Array<{ key: string; description: string; isHistory?: boolean; isSeparator?: boolean; isCustom?: boolean }> = [];

    models.push({ key: '__custom__', description: 'Add custom model...', isCustom: true });

    const history = getModelHistory();
    const recentModels = history.slice(0, 5);

    if (recentModels.length > 0) {
      recentModels.forEach(item => {
        const providerName = PROVIDERS[item.providerType]?.name || item.providerType;
        models.push({
          key: `${item.providerType}:${item.model}`,
          description: `${item.model} (${providerName})`,
          isHistory: true
        });
      });

      models.push({ key: '__separator__', description: '───────────────────', isSeparator: true });
    }

    const providerOption = getProviderOption(currentProvider.type);
    providerOption.defaultModels.forEach(model => {
      models.push({
        key: model,
        description: model
      });
    });

    return models;
  }, [currentProvider]);

  const filteredCommands = useMemo(() => {
    if (!input.startsWith('/')) return commands;
    const searchTerm = input.toLowerCase();
    return commands.filter(cmd => cmd.name.toLowerCase().startsWith(searchTerm));
  }, [input]);

  const filteredShortcuts = useMemo(() => {
    if (!input.startsWith('?')) return shortcuts;
    const searchTerm = input.slice(1).toLowerCase();
    if (searchTerm === '') return shortcuts;
    return shortcuts.filter(sc => sc.key.toLowerCase().includes(searchTerm));
  }, [input]);

  useEffect(() => {
    const loadedConfig = loadConfig();
    setCurrentThemeName(loadedConfig.theme || 'default');
  }, []);

  const orchestrator = useMemo(() => {
    if (!currentProvider) return null;

    const orch = new Orchestrator(currentProvider, {
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
          iterationCount.current = 0;
          currentResponse.current = '';
          setMessages(prev => {
            const idx = prev.length;
            streamingIndex.current = idx;
            return [...prev, { role: 'assistant', content: '' }];
          });
        } else {
          iterationCount.current += 1;
          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            if (updated[idx] && updated[idx].role === 'assistant') {
              const msg = updated[idx] as MessageWithTools;
              const separator = iterationCount.current > 0 && msg.content ? '\n\n' : '';
              currentResponse.current = msg.content + separator;
              updated[idx] = {
                role: 'assistant',
                content: msg.content + separator,
                toolExecutions: msg.toolExecutions
              };
            }
            return updated;
          });
        }
      } else if (event.type === 'ai_stream_delta') {
        const delta = typeof event.data?.delta === 'string' ? event.data.delta : '';
        if (delta.length === 0) return;
        if (streamingIndex.current === null) {
          return;
        }
        setMessages(prev => {
          const updated = [...prev];
          const idx = streamingIndex.current!;
          const msg = updated[idx] as MessageWithTools;
          if (msg && msg.role === 'assistant') {
            const newContent = (msg.content || '') + delta;

            const title = extractTitleFromResponse(newContent);
            if (title) {
              setTerminalTitle(`✹ ${title}`);
            }

            const cleanedContent = removeTitleFromContent(newContent);
            currentResponse.current = cleanedContent;

            updated[idx] = {
              ...msg,
              content: cleanedContent,
              toolExecutions: msg.toolExecutions
            } as MessageWithTools;
          }
          return updated;
        });
        const deltaTokens = estimateTokens(delta);
        setTokenCount(prev => {
          const newCount = prev + deltaTokens;
          currentTokenCount.current = newCount;
          return newCount;
        });
      } else if (event.type === 'tool_executing') {
        const toolName = event.data?.toolName || '';
        executedTools.current.push({
          name: toolName,
          status: 'running',
          parameters: event.data?.parameters,
          timestamp: Date.now()
        });

        if (streamingIndex.current !== null) {
          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant') {
              const toolExecutions = msg.toolExecutions || [];
              const currentContentLength = (msg.content || '').length;
              const newTool = {
                name: toolName,
                displayName: formatToolName(toolName),
                status: 'running' as const,
                parameters: event.data?.parameters,
                insertAt: currentContentLength
              };
              updated[idx] = {
                ...msg,
                toolExecutions: [...toolExecutions, newTool]
              } as MessageWithTools;
            }
            return updated;
          });
        }
      } else if (event.type === 'tool_success' || event.type === 'tool_error') {
        const toolName = event.data?.toolName || '';
        const toolIndex = executedTools.current.findIndex(
          t => t.name === toolName && t.status === 'running'
        );
        if (toolIndex !== -1) {
          executedTools.current[toolIndex] = {
            ...executedTools.current[toolIndex],
            status: event.type === 'tool_success' ? 'completed' : 'error',
            result: event.type === 'tool_success'
              ? (typeof event.data?.result === 'string' ? event.data.result.substring(0, 500) : JSON.stringify(event.data?.result).substring(0, 500))
              : (event.data?.error ? String(event.data.error).substring(0, 500) : undefined)
          };
        }
        if (streamingIndex.current !== null) {
          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant' && msg.toolExecutions) {
              const toolExecutions = [...msg.toolExecutions];
              const toolIndex = toolExecutions.findIndex(
                t => t.name === event.data?.toolName && t.status === 'running'
              );
              if (toolIndex !== -1) {
                const tool = toolExecutions[toolIndex];
                const result = event.type === 'tool_success'
                  ? formatToolResult(tool.name, event.data?.result, tool.parameters)
                  : (event.data?.error ? String(event.data.error).substring(0, 100) : undefined);
                toolExecutions[toolIndex] = {
                  ...tool,
                  status: event.type === 'tool_success' ? 'completed' : 'error',
                  result
                };
                updated[idx] = {
                  ...msg,
                  toolExecutions
                } as MessageWithTools;
              }
            }
            return updated;
          });
        }
      } else if (event.type === 'ai_stream_complete') {
        if (streamingIndex.current !== null && event.data?.content) {
          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant') {
              const finalContent = event.data.content;

              const title = extractTitleFromResponse(finalContent);
              if (title) {
                setTerminalTitle(`✹ ${title}`);
              }

              const cleanedContent = removeTitleFromContent(finalContent);
              currentResponse.current = cleanedContent;

              updated[idx] = {
                ...msg,
                content: cleanedContent,
                toolExecutions: msg.toolExecutions
              } as MessageWithTools;
            }
            return updated;
          });
        }
      } else if (event.type === 'ai_stream_error') {
        isStreaming.current = false;
      } else if (event.type === 'final_response') {
        isStreaming.current = false;
      }
    });

    return orch;
  }, [currentProvider]);

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

  useEffect(() => {
    if (showCommands && selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands, selectedIndex, showCommands]);

  useEffect(() => {
    if (showShortcuts && selectedIndex >= filteredShortcuts.length) {
      setSelectedIndex(Math.max(0, filteredShortcuts.length - 1));
    }
  }, [filteredShortcuts, selectedIndex, showShortcuts]);

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  const executeInitCommand = async () => {
    if (isLoading || !orchestrator) return;

    const mosaicPath = getMosaicFilePath();

    const fs = await import('fs/promises');
    try {
      await fs.unlink(mosaicPath);
    } catch {
    }

    const initMessage: MessageWithTools = {
      role: 'assistant',
      content: `Creating MOSAIC.md for workspace analysis...\n\nTarget file: ${mosaicPath}`
    };
    setMessages(prev => [...prev, initMessage]);

    executionStartTime.current = Date.now();
    executedTools.current = [];
    currentResponse.current = '';
    currentTokenCount.current = 0;

    historyService.addEntry({
      message: '/init',
      timestamp: executionStartTime.current,
      provider: currentProvider ? {
        type: currentProvider.type,
        model: currentProvider.model,
        baseUrl: currentProvider.baseUrl
      } : undefined
    });

    setIsLoading(true);
    setCurrentToolExecutions([]);
    resetExitState();

    try {
      const toolRegistry = orchestrator.getToolRegistry();
      const originalExecute = toolRegistry.execute.bind(toolRegistry);
      const executedToolsForApproval: ToolExecution[] = [];

      toolRegistry.execute = wrapToolExecution(originalExecute, executedToolsForApproval);

      await orchestrator.executeTaskWithPlanning(MOSAIC_INIT_PROMPT);

      toolRegistry.execute = originalExecute;
      setCurrentToolExecutions([]);

      let finalMessage = '';
      try {
        await fs.access(mosaicPath);
        const successMsg: MessageWithTools = {
          role: 'assistant',
          content: `MOSAIC.md created successfully at: ${mosaicPath}`
        };
        setMessages(prev => [...prev, successMsg]);
        finalMessage = successMsg.content;
      } catch {
        const warningMsg: MessageWithTools = {
          role: 'assistant',
          content: `Warning: MOSAIC.md was not created. Please try again.`
        };
        setMessages(prev => [...prev, warningMsg]);
        finalMessage = warningMsg.content;
      }

      const duration = executionStartTime.current ? Date.now() - executionStartTime.current : 0;

      historyService.updateLastEntry({
        response: currentResponse.current || finalMessage,
        tools: executedTools.current,
        tokenCount: currentTokenCount.current,
        duration: duration,
        success: true
      });

    } catch (error) {
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
              toolExecutions: msg.toolExecutions
            } as MessageWithTools;
          }
          return updated;
        }

        const errorMessage: MessageWithTools = {
          role: 'assistant',
          content: errorText
        };
        return [...prev, errorMessage];
      });
      setCurrentToolExecutions([]);

      const duration = executionStartTime.current ? Date.now() - executionStartTime.current : 0;

      historyService.updateLastEntry({
        response: errorText,
        tools: executedTools.current,
        tokenCount: currentTokenCount.current,
        duration: duration,
        success: false,
        error: errorText
      });

    } finally {
      setIsLoading(false);
      streamingIndex.current = null;
      isStreaming.current = false;
      iterationCount.current = 0;
      executionStartTime.current = null;
      executedTools.current = [];
      currentResponse.current = '';
      currentTokenCount.current = 0;
    }
  };

  const handleCommandExecution = (action: string) => {
    executingCommand.current = true;

    if (action === 'theme') {
      setShowThemeSelector(true);
      setSelectedIndex(0);
    } else if (action === 'provider') {
      setShowProviderSelector(true);
      setSelectedIndex(0);
    } else if (action === 'model') {
      setShowModelSelector(true);
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
    } else if (action === 'init') {
      setTimeout(() => {
        executeInitCommand();
      }, 100);
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

  const handleProviderSelection = (providerType: string) => {
    const providerOption = getProviderOption(providerType as any);
    const currentConfig = loadConfig();
    const defaultModel = providerOption.defaultModels[0] || '';

    const newProvider = {
      type: providerType as any,
      model: defaultModel,
      baseUrl: currentConfig.provider?.baseUrl
    };

    updateConfig({
      provider: newProvider
    });

    setCurrentProvider(newProvider);

    const statusMessage: MessageWithTools = {
      role: 'assistant',
      content: `Provider changed to ${providerOption.name} with model ${defaultModel}. Orchestrator reloaded.`
    };
    setMessages([...messages, statusMessage]);

    setShowProviderSelector(false);
    setSelectedIndex(0);
  };

  const handleModelSelection = (modelKey: string) => {
    const currentConfig = loadConfig();
    if (!currentConfig.provider) return;

    if (modelKey === '__custom__') {
      setIsAddingCustomModel(true);
      setCustomModelInput('');
      setShowModelSelector(false);
      return;
    }

    if (modelKey === '__separator__') {
      return;
    }

    let finalProviderType = currentConfig.provider.type;
    let finalModel = modelKey;

    if (modelKey.includes(':')) {
      const [historyProviderType, historyModel] = modelKey.split(':');
      finalProviderType = historyProviderType as any;
      finalModel = historyModel;
    }

    const newProvider = {
      ...currentConfig.provider,
      type: finalProviderType,
      model: finalModel
    };

    updateConfig({
      provider: newProvider
    });

    setCurrentProvider(newProvider);

    addToModelHistory(finalProviderType, finalModel);

    const providerName = PROVIDERS[finalProviderType]?.name || finalProviderType;
    const providerChanged = finalProviderType !== currentConfig.provider.type;
    const statusMessage: MessageWithTools = {
      role: 'assistant',
      content: `Model changed to ${finalModel}${providerChanged ? ` (${providerName})` : ''}. Orchestrator reloaded.`
    };
    setMessages([...messages, statusMessage]);

    setShowModelSelector(false);
    setSelectedIndex(0);
  };

  const handleCustomModelSubmit = () => {
    const currentConfig = loadConfig();
    if (!currentConfig.provider || !customModelInput.trim()) {
      setIsAddingCustomModel(false);
      setCustomModelInput('');
      return;
    }

    const model = customModelInput.trim();

    const newProvider = {
      ...currentConfig.provider,
      model
    };

    updateConfig({
      provider: newProvider
    });

    setCurrentProvider(newProvider);

    addToModelHistory(currentConfig.provider.type, model);

    const statusMessage: MessageWithTools = {
      role: 'assistant',
      content: `Model changed to ${model}. Orchestrator reloaded.`
    };
    setMessages([...messages, statusMessage]);

    setIsAddingCustomModel(false);
    setCustomModelInput('');
  };

  const handleShortcutExecution = (action: string) => {
    if (action === 'clear') {
      setMessages([]);
      setTokenCount(0);
      if (orchestrator) {
        orchestrator.resetContext();
      }
    } else if (action === 'clear-input') {
      setInput('');
    }
  };

  useInput((inputChar, key) => {
    if (!isAddingCustomModel) return;

    if (key.return) {
      handleCustomModelSubmit();
    } else if (key.escape) {
      setIsAddingCustomModel(false);
      setCustomModelInput('');
    } else if (key.backspace || key.delete) {
      setCustomModelInput(prev => prev.slice(0, -1));
    } else if (inputChar && !key.ctrl && !key.meta) {
      setCustomModelInput(prev => prev + inputChar);
    }
  });

  const { resetExitState } = useKeyboardShortcuts({
    input,
    showShortcuts,
    showCommands,
    showThemeSelector,
    showProviderSelector,
    showModelSelector,
    selectedIndex,
    shortcuts,
    commands,
    filteredShortcuts,
    filteredCommands,
    themeNames,
    providerNames,
    availableModels,
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
    onShowProviderSelector: setShowProviderSelector,
    onShowModelSelector: setShowModelSelector,
    onSelectIndex: setSelectedIndex,
    onSelectItem: setInput,
    onShowCtrlCMessage: setShowCtrlCMessage,
    onExecuteCommand: handleCommandExecution,
    onExecuteShortcut: handleShortcutExecution,
    onSelectTheme: handleThemeSelection,
    onSelectProvider: handleProviderSelection,
    onSelectModel: handleModelSelection
  });

  const handleSubmit = async (value: string) => {
    if (value.trim() && !isLoading) {
      const trimmedValue = value.trim();

      const commandMatch = commands.find(cmd => cmd.name === trimmedValue);
      if (commandMatch) {
        handleCommandExecution(commandMatch.action);
        setInput('');
        return;
      }

      if (trimmedValue.startsWith('?')) {
        const shortcutKey = trimmedValue.slice(1);
        const shortcutMatch = shortcuts.find(sc => sc.key.toLowerCase() === shortcutKey.toLowerCase());
        if (shortcutMatch) {
          handleShortcutExecution(shortcutMatch.action);
          setInput('');
          return;
        }
      }

      executionStartTime.current = Date.now();
      executedTools.current = [];
      currentResponse.current = '';
      currentTokenCount.current = 0;

      historyService.addEntry({
        message: trimmedValue,
        timestamp: executionStartTime.current,
        provider: currentProvider ? {
          type: currentProvider.type,
          model: currentProvider.model,
          baseUrl: currentProvider.baseUrl
        } : undefined
      });
      setHistoryIndex(-1);

      const userMessage: MessageWithTools = { role: 'user', content: trimmedValue };
      setMessages(prev => [...prev, userMessage]);

      const userTokens = estimateTokens(trimmedValue);
      setTokenCount(userTokens);
      currentTokenCount.current = userTokens;

      setIsLoading(true);
      setInput('');
      resetExitState();

      if (!orchestrator) {
        const errorMessage: MessageWithTools = {
          role: 'assistant',
          content: 'Error: AI orchestrator not initialized properly'
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);

        historyService.updateLastEntry({
          response: errorMessage.content,
          success: false,
          error: errorMessage.content,
          duration: Date.now() - executionStartTime.current!,
          tokenCount: currentTokenCount.current
        });

        return;
      }

      setIsLoading(true);
      setCurrentToolExecutions([]);

      try {
        const toolRegistry = orchestrator.getToolRegistry();
        const originalExecute = toolRegistry.execute.bind(toolRegistry);
        const executedToolsForApproval: ToolExecution[] = [];

        toolRegistry.execute = wrapToolExecution(originalExecute, executedToolsForApproval);

        const result = await orchestrator.executeTaskWithPlanning(value.trim());

        toolRegistry.execute = originalExecute;

        setCurrentToolExecutions([]);

        const duration = executionStartTime.current ? Date.now() - executionStartTime.current : 0;

        historyService.updateLastEntry({
          response: currentResponse.current || (typeof result === 'string' ? result : result.response),
          tools: executedTools.current,
          tokenCount: currentTokenCount.current,
          duration: duration,
          success: true
        });

      } catch (error) {
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
                toolExecutions: msg.toolExecutions
              } as MessageWithTools;
            }
            return updated;
          }

          const errorMessage: MessageWithTools = {
            role: 'assistant',
            content: errorText
          };
          return [...prev, errorMessage];
        });
        setCurrentToolExecutions([]);

        const duration = executionStartTime.current ? Date.now() - executionStartTime.current : 0;

        historyService.updateLastEntry({
          response: errorText,
          tools: executedTools.current,
          tokenCount: currentTokenCount.current,
          duration: duration,
          success: false,
          error: errorText
        });

      } finally {
        setIsLoading(false);
        streamingIndex.current = null;
        isStreaming.current = false;
        iterationCount.current = 0;
        executionStartTime.current = null;
        executedTools.current = [];
        currentResponse.current = '';
        currentTokenCount.current = 0;
      }
    }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (historyIndex !== -1) {
      setHistoryIndex(-1);
    }
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
      } else {
        return;
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
      return '/ for commands — ? for shortcuts';
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
        provider={currentProvider}
        currentDir={currentDir}
        theme={theme}
      />

      <Box marginTop={1} paddingX={2} flexDirection="column">
        <MessageList
          messages={messages}
          theme={theme}
          isStreaming={isStreaming.current}
          streamingMessageIndex={streamingIndex.current ?? -1}
        />

        {pendingApproval && (
          <ToolApprovalPrompt
            toolName={pendingApproval.toolName}
            preview={pendingApproval.preview}
            theme={theme}
          />
        )}

        {isLoading && !pendingApproval && (
          <LoadingStatus theme={theme} tokenCount={tokenCount} />
        )}
      </Box>

      {!pendingApproval && !isAddingCustomModel && (
        <ChatInput
          input={input}
          terminalWidth={terminalWidth}
          helpText={helpText}
          theme={theme}
          isMenuOpen={showShortcuts || showCommands || showThemeSelector || showProviderSelector || showModelSelector}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          onHistoryNavigation={handleHistoryNavigation}
        />
      )}

      {isAddingCustomModel && (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Box marginBottom={1}>
            <Text color={theme.colors.text}>Enter custom model name:</Text>
          </Box>
          <Box>
            <Text color={theme.colors.primary}>&gt; </Text>
            <Text color={theme.colors.text}>{customModelInput}</Text>
            <Text color={theme.colors.text}>█</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm, Esc to cancel</Text>
          </Box>
        </Box>
      )}

      {showShortcuts && (
        <DropdownMenu
          items={filteredShortcuts.map(s => ({ key: s.key, description: s.description }))}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Keyboard Shortcuts"
        />
      )}

      {showCommands && (
        <DropdownMenu
          items={filteredCommands.map(c => ({ key: c.name, description: c.description }))}
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

      {showProviderSelector && (
        <DropdownMenu
          items={providerNames.map(p => ({ key: p.type, description: p.name }))}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Select Provider"
        />
      )}

      {showModelSelector && (
        <DropdownMenu
          items={availableModels}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Select Model"
        />
      )}
    </Box>
  );
};

export default ChatInterface;