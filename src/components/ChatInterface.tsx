import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConfig, getPackageVersion, getTheme, getThemeNames, updateConfig, getModelHistory, addToModelHistory } from '../config/index.js';

import * as path from 'path';
import { shortcuts, commands } from '../config/shortcuts.js';
import { getProviderTypes, PROVIDERS, getProviderOption, ProviderType } from '../config/providers.js';
import { extractFileReferences, resolveFileReferences, removeFileReferences, formatReferencesForContext } from '../utils/contextReferences.js';

import { Orchestrator, universalAgent, allTools } from '../orchestrator/index.js';
import { ToolExecution, MessageWithTools } from '../types/toolExecution.js';
import { formatToolName, formatToolResult } from '../utils/toolFormatters.js';
import ChatHeader from './ChatHeader.js';
import MessageList from './MessageList.js';
import ChatInput from './ChatInput.js';
import CustomTextInput from './CustomTextInput.js';
import DropdownMenu from './DropdownMenu.js';
import GlowingText from './GlowingText.js';
import ToolExecutionList from './ToolExecutionList.js';
import ToolApprovalPrompt from './ToolApprovalPrompt.js';
import LoadingStatus from './LoadingStatus.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useToolApproval } from '../hooks/useToolApproval.js';
import { historyService } from '../services/historyService.js';
import { verboseLogger as globalVerboseLogger } from '../utils/VerboseLogger.js';
import { extractTitleFromResponse, removeTitleFromContent, setTerminalTitle } from '../utils/terminalUtils.js';
import { MOSAIC_INIT_PROMPT, getMosaicFilePath } from '../utils/mosaicContext.js';
import { undoRedoService, FileSnapshot } from '../services/undoRedoService.js';
import UndoSelector from './UndoSelector.js';
import IdeSelector from './IdeSelector.js';
import { ideService } from '../services/ideIntegration/ideService.js';
import { IDEInstance } from '../services/ideIntegration/types.js';
import * as fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { setSecret, hasSecret } from '../config/secrets.js';

const version = getPackageVersion();

interface ChatInterfaceProps {
  initialVerboseMode?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialVerboseMode = false }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageWithTools[]>([]);
  const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 80);
  const [showCtrlCMessage, setShowCtrlCMessage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showUndoSelector, setShowUndoSelector] = useState(false);
  const [showIdeSelector, setShowIdeSelector] = useState(false);
  const [detectedIDEs, setDetectedIDEs] = useState<IDEInstance[]>([]);
  const [showApiKeyProviderSelector, setShowApiKeyProviderSelector] = useState(false);
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
  const [verboseMode, setVerboseMode] = useState<boolean>(initialVerboseMode);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const executingCommand = useRef(false);
  const verboseLogger = useRef(globalVerboseLogger);
  const streamingIndex = useRef<number | null>(null);
  const isStreaming = useRef<boolean>(false);
  const [isStreamingState, setIsStreamingState] = useState<boolean>(false);
  const shouldStopStreaming = useRef<boolean>(false);
  const iterationCount = useRef<number>(0);
  const executionStartTime = useRef<number | null>(null);
  const executedTools = useRef<any[]>([]);
  const currentResponse = useRef<string>('');
  const currentTokenCount = useRef<number>(0);
  const [showProviderApiKeyPrompt, setShowProviderApiKeyPrompt] = useState(false);
  const [providerPendingApiKey, setProviderPendingApiKey] = useState<ProviderType | null>(null);
  const [providerPendingModel, setProviderPendingModel] = useState<string | null>(null);
  const [providerApiKeyInput, setProviderApiKeyInput] = useState('');
  const [apiKeyProviderForEdit, setApiKeyProviderForEdit] = useState<ProviderType | null>(null);

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

  useEffect(() => {
    if (initialVerboseMode) {
      verboseLogger.current.setEnabled(true);
      setVerboseMode(true);
    }
  }, [initialVerboseMode]);

  const orchestrator = useMemo(() => {
    if (!currentProvider) return null;

    const orch = new Orchestrator(currentProvider, {
      maxIterations: 30,
      enableToolChaining: true,
      toolTimeout: 30000,
      defaultAgent: 'universal_agent'
    });

    orch.registerAgent(universalAgent);
    allTools.forEach(tool => orch.registerTool(tool));

    orch.on((event) => {
      verboseLogger.current.log(event);

      if (shouldStopStreaming.current) {
        return;
      }

      if (event.type === 'ai_stream_start') {
        isStreaming.current = true;
        setIsStreamingState(true);
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
          const separator = '\n\n';
          currentResponse.current = currentResponse.current + separator;

          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            if (updated[idx] && updated[idx].role === 'assistant') {
              const msg = updated[idx] as MessageWithTools;
              const cleanedContent = removeTitleFromContent(currentResponse.current);
              updated[idx] = {
                role: 'assistant',
                content: cleanedContent,
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

        currentResponse.current = currentResponse.current + delta;

        const title = extractTitleFromResponse(currentResponse.current);
        if (title) {
          setTerminalTitle(`✹ ${title}`);
        }

        const cleanedContent = removeTitleFromContent(currentResponse.current);

        setMessages(prev => {
          const updated = [...prev];
          const idx = streamingIndex.current!;
          const msg = updated[idx] as MessageWithTools;
          if (msg && msg.role === 'assistant') {
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
          const cleanedContentLength = removeTitleFromContent(currentResponse.current).length;

          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant') {
              const toolExecutions = msg.toolExecutions || [];
              const newTool = {
                name: toolName,
                displayName: formatToolName(toolName),
                status: 'running' as const,
                parameters: event.data?.parameters,
                insertAt: cleanedContentLength
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
                const diffLines = event.type === 'tool_success' && event.data?.result?.diffLines
                  ? event.data.result.diffLines
                  : undefined;
                toolExecutions[toolIndex] = {
                  ...tool,
                  status: event.type === 'tool_success' ? 'completed' : 'error',
                  result,
                  diffLines
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
          const finalContent = event.data.content;

          const title = extractTitleFromResponse(finalContent);
          if (title) {
            setTerminalTitle(`✹ ${title}`);
          }

          const cleanedContent = removeTitleFromContent(finalContent);
          currentResponse.current = cleanedContent;

          setMessages(prev => {
            const updated = [...prev];
            const idx = streamingIndex.current!;
            const msg = updated[idx] as MessageWithTools;
            if (msg && msg.role === 'assistant') {
              if (msg.content !== cleanedContent) {
                updated[idx] = {
                  ...msg,
                  content: cleanedContent,
                  toolExecutions: msg.toolExecutions
                } as MessageWithTools;
              }
            }
            return updated;
          });
        }
      } else if (event.type === 'ai_stream_error') {
        isStreaming.current = false;
        setIsStreamingState(false);
      } else if (event.type === 'final_response') {
        isStreaming.current = false;
        setIsStreamingState(false);
      } else if (event.type === 'token_usage') {
        const source = event.data?.source;
        const tokens = typeof event.data?.tokens === 'number' ? event.data.tokens : 0;

        if (tokens > 0 && source !== 'intention_analysis' && source !== 'task_planning') {
          setTokenCount(prev => {
            const newCount = prev + tokens;
            currentTokenCount.current = newCount;
            return newCount;
          });
        }
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

    setTokenCount(0);
    currentTokenCount.current = 0;

    const mosaicPath = getMosaicFilePath();

    const fs = await import('fs/promises');
    const workspaceDir = process.cwd();
    const workspaceMosaicDir = path.join(workspaceDir, '.mosaic');
    const workspaceConfigPath = path.join(workspaceDir, 'mosaic.jsonc');

    try {
      await fs.mkdir(workspaceMosaicDir, { recursive: true });
      try {
        await fs.access(workspaceConfigPath);
      } catch {
        const defaultConfig = [
          '{',
          `  "workspaceRoot": ${JSON.stringify(workspaceDir)}`,
          '}',
          ''
        ].join('\n');
        await fs.writeFile(workspaceConfigPath, defaultConfig, 'utf-8');
      }
    } catch {
    }

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
      const filesModified: FileSnapshot[] = [];

      const trackingWrapper = async (toolName: string, params: Record<string, any>, context: any) => {
        if (toolName === 'write_file' || toolName === 'update_file' || toolName === 'delete_file') {
          const filePath = path.resolve(context.workingDirectory, params.path);
          try {
            const existsBefore = existsSync(filePath);
            const contentBefore = existsBefore ? readFileSync(filePath, 'utf-8') : '';

            filesModified.push({
              path: filePath,
              content: contentBefore,
              exists: existsBefore
            });
          } catch (error) {
          }
        }

        return originalExecute(toolName, params, context);
      };

      toolRegistry.execute = wrapToolExecution(trackingWrapper, executedToolsForApproval);

      await orchestrator.executeTask(MOSAIC_INIT_PROMPT);

      toolRegistry.execute = originalExecute;
      setCurrentToolExecutions([]);

      if (filesModified.length > 0) {
        const currentMessageIndex = messages.length - 1;
        undoRedoService.createSnapshot(currentMessageIndex, '/init', filesModified);
      }

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
      setIsStreamingState(false);
      shouldStopStreaming.current = false;
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
    } else if (action === 'apikey') {
      setShowApiKeyProviderSelector(true);
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
    } else if (action === 'undo') {
      setShowUndoSelector(true);
      setSelectedIndex(0);
    } else if (action === 'redo') {
      handleRedo();
    } else if (action === 'ide') {
      setTimeout(async () => {
        const instances = await ideService.detectIDEs(true);
        setDetectedIDEs(instances);

        if (instances.length === 0) {
          const statusMessage: MessageWithTools = {
            role: 'assistant',
            content: 'No running IDEs detected. Please open VSCode, Cursor, or Windsurf.'
          };
          setMessages([...messages, statusMessage]);
        } else {
          setShowIdeSelector(true);
          setSelectedIndex(0);
        }
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
    const providerKey = providerType as ProviderType;
    const providerOption = getProviderOption(providerKey);

    const currentConfig = loadConfig();
    const defaultModel = providerOption.defaultModels[0] || '';

    const needsApiKey = providerOption.requiresApiKey;
    const secretKeyName = `${providerKey}_api_key`;

    if (!showApiKeyProviderSelector && needsApiKey && !hasSecret(secretKeyName)) {
      setShowProviderSelector(false);
      setSelectedIndex(0);

      setProviderPendingApiKey(providerKey);
      setProviderPendingModel(defaultModel);

      const infoMessage: MessageWithTools = {
        role: 'assistant',
        content: `No API key configured for ${providerOption.name}. Please enter your API key to use this provider.`
      };
      setMessages([...messages, infoMessage]);

      setShowProviderApiKeyPrompt(true);
      return;
    }

    const newProvider = {
      type: providerKey,
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

  const handleApiKeyProviderSelection = (providerType: string) => {
    const providerKey = providerType as ProviderType;
    setApiKeyProviderForEdit(providerKey);
    setProviderApiKeyInput('');

    const providerOption = getProviderOption(providerKey);
    const hasExisting = hasSecret(`${providerKey}_api_key`);

    const infoMessage: MessageWithTools = {
      role: 'assistant',
      content: hasExisting
        ? `Updating API key for ${providerOption.name}. Enter a new key to replace the existing one.`
        : `No API key configured for ${providerOption.name}. Please enter your API key.`,
    };
    setMessages([...messages, infoMessage]);

    setShowApiKeyProviderSelector(false);
    setShowProviderApiKeyPrompt(true);
  };

  const handleUndoSelection = async (messageIndex: number) => {
    setShowUndoSelector(false);
    setSelectedIndex(0);
    setIsLoading(true);

    const targetMessage = messages[messageIndex];
    const userInput = targetMessage?.role === 'user' ? targetMessage.content : '';

    const statusMessage: MessageWithTools = {
      role: 'assistant',
      content: 'Undoing conversation and restoring files...'
    };
    setMessages(prev => [...prev, statusMessage]);

    try {
      const { filesRestored, errors } = await undoRedoService.restoreToSnapshot(messageIndex, messages.length);

      setMessages(prev => prev.slice(0, messageIndex + 1));

      if (orchestrator) {
        orchestrator.resetContext();
      }

      let resultContent = `Undo complete.\n\n`;
      if (filesRestored.length > 0) {
        resultContent += `Files restored:\n`;
        filesRestored.forEach(file => {
          resultContent += `  - ${file}\n`;
        });
      } else {
        resultContent += 'No files needed restoration.\n';
      }

      if (errors.length > 0) {
        resultContent += `\nErrors encountered:\n`;
        errors.forEach(error => {
          resultContent += `  - ${error}\n`;
        });
      }

      const resultMessage: MessageWithTools = {
        role: 'assistant',
        content: resultContent
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = resultMessage;
        return updated;
      });

      if (userInput) {
        setInput(userInput);
      }

    } catch (error) {
      const errorMessage: MessageWithTools = {
        role: 'assistant',
        content: `Error during undo: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = errorMessage;
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIdeSelection = (index: number) => {
    const selectedIde = detectedIDEs[index];
    if (!selectedIde) return;

    ideService.selectIDE(selectedIde);

    const statusMessage: MessageWithTools = {
      role: 'assistant',
      content: `IDE selected: ${selectedIde.name}${selectedIde.workspacePath ? ` (${selectedIde.workspacePath})` : ''}\n\nYou can now use the following actions:\n  - Open files in the IDE\n  - Focus the IDE window\n  - View workspace information`
    };
    setMessages([...messages, statusMessage]);

    setShowIdeSelector(false);
    setSelectedIndex(0);
  };

  const handleRedo = async () => {
    if (!undoRedoService.canRedo()) {
      const warningMessage: MessageWithTools = {
        role: 'assistant',
        content: 'Nothing to redo.'
      };
      setMessages([...messages, warningMessage]);
      return;
    }

    setIsLoading(true);

    const statusMessage: MessageWithTools = {
      role: 'assistant',
      content: 'Redoing changes...'
    };
    setMessages(prev => [...prev, statusMessage]);

    try {
      const result = await undoRedoService.redo();

      if (!result) {
        const errorMessage: MessageWithTools = {
          role: 'assistant',
          content: 'Nothing to redo.'
        };
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = errorMessage;
          return updated;
        });
        return;
      }

      const { filesRestored, errors } = result;

      let resultContent = `Redo complete.\n\n`;
      if (filesRestored.length > 0) {
        resultContent += `Files restored:\n`;
        filesRestored.forEach(file => {
          resultContent += `  - ${file}\n`;
        });
      } else {
        resultContent += 'No files needed restoration.\n';
      }

      if (errors.length > 0) {
        resultContent += `\nErrors encountered:\n`;
        errors.forEach(error => {
          resultContent += `  - ${error}\n`;
        });
      }

      const resultMessage: MessageWithTools = {
        role: 'assistant',
        content: resultContent
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = resultMessage;
        return updated;
      });

    } catch (error) {
      const errorMessage: MessageWithTools = {
        role: 'assistant',
        content: `Error during redo: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = errorMessage;
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
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

  const handleProviderApiKeySubmit = () => {
    const targetProvider = apiKeyProviderForEdit || providerPendingApiKey;

    if (!targetProvider) {
      setShowProviderApiKeyPrompt(false);
      setProviderApiKeyInput('');
      setApiKeyProviderForEdit(null);
      setProviderPendingApiKey(null);
      setProviderPendingModel(null);
      return;
    }

    const trimmed = providerApiKeyInput.trim();
    const providerOption = getProviderOption(targetProvider);

    if (!trimmed) {
      const warningMessage: MessageWithTools = {
        role: 'assistant',
        content: apiKeyProviderForEdit
          ? `No API key entered. Provider ${providerOption.name} API key was not changed.`
          : `No API key entered. Provider ${providerOption.name} was not changed.`,
      };

      setMessages([...messages, warningMessage]);

      setShowProviderApiKeyPrompt(false);
      setApiKeyProviderForEdit(null);
      setProviderPendingApiKey(null);
      setProviderPendingModel(null);
      setProviderApiKeyInput('');
      return;
    }

    setSecret(`${targetProvider}_api_key`, trimmed);

    // If we came from /provider (no apiKeyProviderForEdit), also switch provider now
    if (!apiKeyProviderForEdit && providerPendingModel) {
      const currentConfig = loadConfig();
      const newProvider = {
        type: targetProvider,
        model: providerPendingModel,
        baseUrl: currentConfig.provider?.baseUrl
      };

      updateConfig({
        provider: newProvider
      });

      setCurrentProvider(newProvider);

      const statusMessage: MessageWithTools = {
        role: 'assistant',
        content: `Provider changed to ${providerOption.name} with model ${providerPendingModel}. API key saved. Orchestrator reloaded.`
      };
      setMessages([...messages, statusMessage]);
    } else {
      const statusMessage: MessageWithTools = {
        role: 'assistant',
        content: `API key for ${providerOption.name} has been saved.`
      };
      setMessages([...messages, statusMessage]);
    }

    setShowProviderApiKeyPrompt(false);
    setApiKeyProviderForEdit(null);
    setProviderPendingApiKey(null);
    setProviderPendingModel(null);
    setProviderApiKeyInput('');
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

    if (key.escape) {
      setIsAddingCustomModel(false);
      setCustomModelInput('');
    }
  });

  useInput((inputChar, key) => {
    if (!showProviderApiKeyPrompt) return;

    if (key.escape) {
      setShowProviderApiKeyPrompt(false);
      setApiKeyProviderForEdit(null);
      setProviderPendingApiKey(null);
      setProviderPendingModel(null);
      setProviderApiKeyInput('');
    }
  });

  const userMessages = useMemo(() => {
    return messages
      .map((msg, index) => ({ msg, originalIndex: index }))
      .filter(item => item.msg.role === 'user');
  }, [messages]);

  const activeApiKeyProvider = apiKeyProviderForEdit ?? providerPendingApiKey;

  const { resetExitState } = useKeyboardShortcuts({
    input,
    showShortcuts,
    showCommands,
    showThemeSelector,
    showProviderSelector,
    showModelSelector,
    showUndoSelector,
    showIdeSelector,
    showApiKeyProviderSelector,
    selectedIndex,
    shortcuts,
    commands,
    filteredShortcuts,
    filteredCommands,
    themeNames,
    providerNames,
    availableModels,
    userMessages,
    detectedIDEs,
    isStreaming: isStreamingState,
    onClearMessages: () => {
      setMessages([]);
      setTokenCount(0);
      if (orchestrator) {
        orchestrator.resetContext();
      }
      undoRedoService.clearSnapshots();
    },
    onClearInput: () => setInput(''),
    onShowShortcuts: setShowShortcuts,
    onShowCommands: setShowCommands,
    onShowThemeSelector: setShowThemeSelector,
    onShowProviderSelector: setShowProviderSelector,
    onShowModelSelector: setShowModelSelector,
    onShowUndoSelector: setShowUndoSelector,
    onShowIdeSelector: setShowIdeSelector,
    onShowApiKeyProviderSelector: setShowApiKeyProviderSelector,
    onSelectIndex: setSelectedIndex,
    onSelectItem: setInput,
    onShowCtrlCMessage: setShowCtrlCMessage,
    onStopStreaming: () => {
      shouldStopStreaming.current = true;
      isStreaming.current = false;
      setIsStreamingState(false);
      if (streamingIndex.current !== null) {
        setMessages(prev => {
          const updated = [...prev];
          const idx = streamingIndex.current!;
          const msg = updated[idx] as MessageWithTools;

          if (msg && msg.role === 'assistant') {
            updated[idx] = {
              ...msg,
              interrupted: true
            } as MessageWithTools;
          }

          return updated;
        });
      }

      setIsLoading(false);
      setCurrentToolExecutions([]);
    },
    onExecuteCommand: handleCommandExecution,
    onExecuteShortcut: handleShortcutExecution,
    onSelectTheme: handleThemeSelection,
    onSelectProvider: handleProviderSelection,
    onSelectModel: handleModelSelection,
    onSelectUndo: handleUndoSelection,
    onSelectIde: handleIdeSelection,
    onSelectApiKeyProvider: handleApiKeyProviderSelection
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

      const fileReferences = extractFileReferences(trimmedValue);
      let messageContent = trimmedValue;
      let contextAddition = '';

      if (fileReferences.length > 0) {
        const workingDir = process.cwd();
        const resolvedRefs = await resolveFileReferences(fileReferences, workingDir);
        contextAddition = formatReferencesForContext(resolvedRefs);
        messageContent = removeFileReferences(trimmedValue);
      }

      const finalMessage = messageContent + contextAddition;

      executionStartTime.current = Date.now();
      executedTools.current = [];
      currentResponse.current = '';
      currentTokenCount.current = 0;
      setTokenCount(0);

      historyService.addEntry({
        message: messageContent,
        timestamp: executionStartTime.current,
        provider: currentProvider ? {
          type: currentProvider.type,
          model: currentProvider.model,
          baseUrl: currentProvider.baseUrl
        } : undefined
      });
      setHistoryIndex(-1);

      const userMessage: MessageWithTools = { role: 'user', content: messageContent };
      setMessages(prev => [...prev, userMessage]);

      setIsLoading(true);
      shouldStopStreaming.current = false;
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
        const filesModified: FileSnapshot[] = [];

        const trackingWrapper = async (toolName: string, params: Record<string, any>, context: any) => {
          if (toolName === 'write_file' || toolName === 'update_file' || toolName === 'delete_file') {
            const filePath = path.resolve(context.workingDirectory, params.path);
            try {
              const existsBefore = existsSync(filePath);
              const contentBefore = existsBefore ? readFileSync(filePath, 'utf-8') : '';

              filesModified.push({
                path: filePath,
                content: contentBefore,
                exists: existsBefore
              });
            } catch (error) {
            }
          }

          return originalExecute(toolName, params, context);
        };

        toolRegistry.execute = wrapToolExecution(trackingWrapper, executedToolsForApproval);

        const result = await orchestrator.executeTaskWithPlanning(finalMessage);

        toolRegistry.execute = originalExecute;

        setCurrentToolExecutions([]);

        if (filesModified.length > 0) {
          const currentMessageIndex = messages.length;
          undoRedoService.createSnapshot(currentMessageIndex, messageContent, filesModified);
        }

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
        setIsStreamingState(false);
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
        verboseMode={verboseMode}
        theme={theme}
      />

      <Box marginTop={1} paddingX={2} flexDirection="column">
        <MessageList
          messages={messages}
          theme={theme}
          isStreaming={isStreaming.current}
          streamingMessageIndex={streamingIndex.current ?? -1}
        />

        {pendingApproval && pendingApproval.previewData && (
          <ToolApprovalPrompt
            toolName={pendingApproval.toolName}
            filePath={pendingApproval.previewData.filePath}
            diffLines={pendingApproval.previewData.diffLines}
            theme={theme}
            terminalWidth={terminalWidth}
            onApprove={pendingApproval.onApprove}
            onReject={pendingApproval.onReject}
            onApproveAll={pendingApproval.onApproveAll || (() => { })}
            onModify={pendingApproval.onModify || (() => { })}
          />
        )}

        {isLoading && !pendingApproval && (
          <LoadingStatus theme={theme} tokenCount={tokenCount} />
        )}
      </Box>

      {!pendingApproval && !isAddingCustomModel && !showProviderApiKeyPrompt && (
        <ChatInput
          input={input}
          terminalWidth={terminalWidth}
          helpText={helpText}
          theme={theme}
          isMenuOpen={showShortcuts || showCommands || showThemeSelector || showProviderSelector || showModelSelector || showUndoSelector || showIdeSelector || showApiKeyProviderSelector}
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
            <CustomTextInput
              value={customModelInput}
              onChange={setCustomModelInput}
              onSubmit={handleCustomModelSubmit}
              placeholder="model-name"
              focus={true}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm — esc to cancel</Text>
          </Box>
        </Box>
      )}

      {showProviderApiKeyPrompt && activeApiKeyProvider && (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Box marginBottom={1}>
            <Text color={theme.colors.text}>
              Enter API key for {PROVIDERS[activeApiKeyProvider].name}:
            </Text>
          </Box>
          <Box marginLeft={2} flexDirection="column">
            <Box marginBottom={1}>
              <Text color={theme.colors.text}>
                Your API key will be securely stored in .mosaic/.secrets.json
              </Text>
            </Box>
            <Box>
              <Text color={theme.colors.primary}>API Key: </Text>
              <CustomTextInput
                value={providerApiKeyInput}
                onChange={setProviderApiKeyInput}
                onSubmit={handleProviderApiKeySubmit}
                mask="*"
                focus={true}
              />
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to confirm — esc to cancel</Text>
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

      {showApiKeyProviderSelector && (
        <DropdownMenu
          items={providerNames.map(p => ({ key: p.type, description: p.name }))}
          selectedIndex={selectedIndex}
          theme={theme}
          title="Select Provider for API key"
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

      {showUndoSelector && (
        <UndoSelector
          messages={messages}
          selectedIndex={selectedIndex}
          theme={theme}
        />
      )}

      {showIdeSelector && (
        <IdeSelector
          instances={detectedIDEs}
          selectedIndex={selectedIndex}
          theme={theme}
        />
      )}
    </Box>
  );
};

export default ChatInterface;