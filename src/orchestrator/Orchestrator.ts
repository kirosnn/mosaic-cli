import {
  Agent,
  AgentContext,
  Message,
  ToolCall,
  ToolResult,
  OrchestratorConfig,
  ExecutionStep,
  OrchestratorState,
  OrchestratorEvent,
  OrchestratorEventListener
} from './types.js';
import { ToolRegistry } from './tools/registry.js';
import { AIProvider } from '../services/aiProvider.js';
import { ProviderConfig } from '../config/providers.js';
import { IntentionDetector } from './planning/IntentionDetector.js';
import { TaskPlanner, ExecutionPlan } from './planning/TaskPlanner.js';
import { buildOrchestratorSystemPrompt } from '../config/systemPrompt.js';
import { filterToolCallsFromText } from '../utils/streamFilter.js';
import { createPathValidator } from './tools/pathValidator.js';
import { verboseLogger } from '../utils/VerboseLogger.js';

export class Orchestrator {
  private agents: Map<string, Agent> = new Map();
  private toolRegistry: ToolRegistry;
  private aiProvider: AIProvider;
  private config: OrchestratorConfig;
  private state: OrchestratorState;
  private intentionDetector: IntentionDetector;
  private taskPlanner: TaskPlanner;
  private eventListeners: OrchestratorEventListener[] = [];

  constructor(
    providerConfig: ProviderConfig,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.toolRegistry = new ToolRegistry();
    this.aiProvider = new AIProvider(providerConfig);

    const reportTokenUsage = (tokens: number, source: string) => {
      this.emit({
        type: 'token_usage',
        timestamp: new Date(),
        data: { source, tokens }
      });
    };

    this.intentionDetector = new IntentionDetector(this.aiProvider, reportTokenUsage);
    this.taskPlanner = new TaskPlanner(this.aiProvider, reportTokenUsage);

    this.config = {
      maxIterations: config.maxIterations ?? 30,
      enableToolChaining: config.enableToolChaining ?? true,
      toolTimeout: config.toolTimeout ?? 30000,
      defaultAgent: config.defaultAgent
    };

    const workingDirectory = process.cwd();
    const pathValidator = createPathValidator(workingDirectory);

    const cleanEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        cleanEnv[key] = String(value);
      }
    }

    this.state = {
      currentAgent: config.defaultAgent || 'default',
      executionHistory: [],
      toolResults: new Map(),
      context: {
        conversationHistory: [],
        workingDirectory: workingDirectory,
        environment: cleanEnv,
        metadata: {},
        pathValidator: pathValidator
      }
    };
  }

  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  registerTool(tool: any): void {
    this.toolRegistry.register(tool);
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  on(listener: OrchestratorEventListener): void {
    this.eventListeners.push(listener);
  }

  off(listener: OrchestratorEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emit(event: OrchestratorEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        const details = error instanceof Error ? error.stack || error.message : String(error);
        verboseLogger.logMessage(`[Orchestrator] Error in event listener: ${details}`, 'error');
      }
    }
  }

  async executeTaskWithPlanning(
    userMessage: string,
    agentId?: string
  ): Promise<{
    response: string;
    toolsUsed: string[];
    steps: ExecutionStep[];
    plan?: ExecutionPlan;
    intention?: any;
  }> {
    const targetAgentId = agentId || this.config.defaultAgent || this.state.currentAgent;
    const agent = this.agents.get(targetAgentId);

    if (!agent) {
      throw new Error(`Agent ${targetAgentId} not found`);
    }

    const intention = await this.intentionDetector.analyzeIntent(
      userMessage,
      agent.availableTools
    );

    this.state.context.metadata.currentIntention = intention;

    const toolSchemas = this.toolRegistry.getAllToolSchemas();
    const plan = await this.taskPlanner.createPlan(userMessage, intention, toolSchemas);

    this.state.context.metadata.currentPlan = plan;

    const result = await this.executeTask(userMessage, agentId);

    return {
      ...result,
      plan,
      intention
    };
  }

  async executeTask(
    userMessage: string,
    agentId?: string
  ): Promise<{ response: string; toolsUsed: string[]; steps: ExecutionStep[] }> {
    const targetAgentId = agentId || this.config.defaultAgent || this.state.currentAgent;
    const agent = this.agents.get(targetAgentId);

    if (!agent) {
      throw new Error(`Agent ${targetAgentId} not found`);
    }

    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    this.state.context.conversationHistory.push(userMsg);

    const toolsUsed: string[] = [];
    const steps: ExecutionStep[] = [];
    let iteration = 0;
    let finalResponse = '';

    while (iteration < this.config.maxIterations) {
      iteration++;

      this.emit({
        type: 'iteration_start',
        timestamp: new Date(),
        data: { iteration, maxIterations: this.config.maxIterations }
      });

      this.emit({
        type: 'ai_thinking',
        timestamp: new Date(),
        data: { message: 'Analyzing request and determining next action...' }
      });

      const messages = this.prepareMessages(agent);
      this.emit({
        type: 'ai_stream_start',
        timestamp: new Date(),
        data: { iteration }
      });
      let accumulated = '';
      let lastStreamedLength = 0;
      const aiResponse = await this.aiProvider.sendMessageStream(messages, (delta: string) => {
        accumulated += delta;
        const fullFiltered = filterToolCallsFromText(accumulated);
        const newFilteredText = fullFiltered.slice(lastStreamedLength);

        if (newFilteredText.length > 0) {
          this.emit({
            type: 'ai_stream_delta',
            timestamp: new Date(),
            data: { delta: newFilteredText }
          });
          lastStreamedLength = fullFiltered.length;
        }
      });

      if (aiResponse.error) {
        this.emit({
          type: 'ai_stream_error',
          timestamp: new Date(),
          data: { error: aiResponse.error }
        });
        this.emit({
          type: 'error',
          timestamp: new Date(),
          data: { error: aiResponse.error }
        });
        throw new Error(`AI Provider error: ${aiResponse.error}`);
      }

      const finalContent = aiResponse.content || accumulated;

      if (!aiResponse.error && accumulated) {
        const filteredAccumulated = filterToolCallsFromText(accumulated);
        if (filteredAccumulated && filteredAccumulated.length > 0) {
          this.emit({
            type: 'ai_stream_complete',
            timestamp: new Date(),
            data: { content: filteredAccumulated }
          });
        }
      }
      this.emit({
        type: 'ai_response',
        timestamp: new Date(),
        data: { content: finalContent }
      });

      const assistantMsg: Message = {
        role: 'assistant',
        content: finalContent,
        timestamp: new Date()
      };

      this.state.context.conversationHistory.push(assistantMsg);

      const toolCalls = this.extractToolCalls(finalContent);

      if (toolCalls.length === 0) {
        const filteredFinalContent = filterToolCallsFromText(finalContent);
        this.emit({
          type: 'final_response',
          timestamp: new Date(),
          data: { response: filteredFinalContent }
        });
        finalResponse = filteredFinalContent;
        break;
      }

      this.emit({
        type: 'tool_call_detected',
        timestamp: new Date(),
        data: { count: toolCalls.length, tools: toolCalls.map(tc => tc.toolName) }
      });

      for (const toolCall of toolCalls) {
        if (!agent.availableTools.includes(toolCall.toolName)) {
          continue;
        }

        this.emit({
          type: 'tool_executing',
          timestamp: new Date(),
          data: { toolName: toolCall.toolName, parameters: toolCall.parameters }
        });

        const result = await this.toolRegistry.execute(
          toolCall.toolName,
          toolCall.parameters,
          this.state.context,
          this.config.toolTimeout
        );

        if (result.success) {
          this.emit({
            type: 'tool_success',
            timestamp: new Date(),
            data: { toolName: toolCall.toolName, result: result.data }
          });
        } else {
          this.emit({
            type: 'tool_error',
            timestamp: new Date(),
            data: { toolName: toolCall.toolName, error: result.error }
          });
        }

        toolsUsed.push(toolCall.toolName);
        this.state.toolResults.set(toolCall.id, result);

        const toolResultMsg: Message = {
          role: 'tool',
          content: JSON.stringify(result),
          toolCall,
          toolResult: result,
          timestamp: new Date()
        };

        this.state.context.conversationHistory.push(toolResultMsg);

        const enrichedContent = this.enrichToolResultMessage(toolResultMsg);
        const toolTokens = this.estimateTokens(enrichedContent);
        this.emit({
          type: 'token_usage',
          timestamp: new Date(),
          data: { source: 'tool_result', toolName: toolCall.toolName, tokens: toolTokens }
        });

        steps.push({
          action: 'tool_call',
          toolName: toolCall.toolName,
          parameters: toolCall.parameters
        });

        if (!this.config.enableToolChaining) {
          break;
        }
      }
    }

    return {
      response: finalResponse,
      toolsUsed: Array.from(new Set(toolsUsed)),
      steps
    };
  }

  private prepareMessages(agent: Agent): any[] {
    const messages: any[] = [];

    const systemPrompt = this.buildSystemPrompt(agent);
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    const providerType = this.aiProvider.getConfig().type;
    const keepToolRole = providerType === 'ollama';

    for (const msg of this.state.context.conversationHistory) {
      if (msg.role === 'tool') {
        messages.push({
          role: keepToolRole ? 'tool' : 'user',
          content: this.enrichToolResultMessage(msg)
        });
      } else {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    if (keepToolRole && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      verboseLogger.logMessage(`[Orchestrator] Last message role before sending to Ollama: ${lastMessage.role}`, 'info');

      if (lastMessage.role === 'assistant') {
        verboseLogger.logMessage('[Orchestrator] WARNING: Last message is assistant, adding continuation prompt for Ollama', 'warning');
        messages.push({
          role: 'user',
          content: 'Continue with your analysis and provide a complete response based on the tool results above.'
        });
      }
    }

    return messages;
  }

  private enrichToolResultMessage(msg: Message): string {
    if (!msg.toolCall || !msg.toolResult) {
      return `Tool result: ${msg.content}`;
    }

    const { toolCall, toolResult } = msg;
    let enriched = `Tool "${toolCall.toolName}" executed with parameters:\n${JSON.stringify(toolCall.parameters, null, 2)}\n\n`;

    if (toolResult.success) {
      enriched += `Result: SUCCESS\n${JSON.stringify(toolResult.data, null, 2)}\n\n`;
      enriched += `**CRITICAL**: You MUST now analyze these results and provide a comprehensive response to the USER.\n`;
      enriched += `Your task is NOT complete - you need to:\n`;
      enriched += `1. Analyze the data returned by the tool\n`;
      enriched += `2. Extract key information relevant to the USER's request\n`;
      enriched += `3. Present findings in a clear, organized way\n`;
      enriched += `4. Provide insights, recommendations, or next steps\n\n`;
      enriched += `Remember: Tool execution is a MEANS to answer the USER's question, not the END. Continue your response now.`;
    } else {
      enriched += `Result: FAILED\nError: ${toolResult.error}\n\n`;
      enriched += `The tool failed. Try alternative approaches using different tools or parameters, or explain the issue to the USER if no alternatives exist.`;
    }

    if (toolResult.metadata && Object.keys(toolResult.metadata).length > 0) {
      enriched += `\n\nAdditional context: ${JSON.stringify(toolResult.metadata, null, 2)}`;
    }

    return enriched;
  }

  private buildSystemPrompt(agent: Agent): string {
    const toolSchemas = agent.availableTools.map(toolName => this.toolRegistry.getToolSchema(toolName)).filter(Boolean);
    return buildOrchestratorSystemPrompt(agent.systemPrompt, agent.availableTools, toolSchemas);
  }

  private extractToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    try {
      let jsonContent = response;

      const jsonBlockStart = response.search(/```(?:json)?\s*[\[\{]/);
      if (jsonBlockStart !== -1) {
        const contentStart = response.indexOf('\n', jsonBlockStart);
        if (contentStart !== -1) {
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          let endPos = -1;

          for (let i = contentStart + 1; i < response.length - 2; i++) {
            const char = response[i];
            const next3 = response.slice(i, i + 3);

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (next3 === '```') {
                endPos = i;
                break;
              }
              if (char === '{' || char === '[') depth++;
              if (char === '}' || char === ']') {
                depth--;
                if (depth === 0) {
                  const afterClosing = response.indexOf('```', i);
                  if (afterClosing !== -1 && afterClosing - i < 50) {
                    endPos = afterClosing;
                    break;
                  }
                }
              }
            }
          }

          if (endPos !== -1) {
            jsonContent = response.slice(contentStart + 1, endPos).trim();
          }
        }
      }

      try {
        const parsed = JSON.parse(jsonContent);

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.tool && typeof item.tool === 'string') {
              toolCalls.push({
                toolName: item.tool,
                parameters: item.parameters || {},
                id: this.generateToolCallId()
              });
            }
          }
          if (toolCalls.length > 0) {
            return toolCalls;
          }
        } else if (parsed.tool && typeof parsed.tool === 'string') {
          toolCalls.push({
            toolName: parsed.tool,
            parameters: parsed.parameters || {},
            id: this.generateToolCallId()
          });
          return toolCalls;
        }
      } catch (parseError) {
      }

      const jsonArrayMatch = jsonContent.match(/\[\s*\{[\s\S]*?"tool"[\s\S]*?\}\s*\]/);
      if (jsonArrayMatch) {
        try {
          const parsed = JSON.parse(jsonArrayMatch[0]);

          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item.tool && typeof item.tool === 'string') {
                toolCalls.push({
                  toolName: item.tool,
                  parameters: item.parameters || {},
                  id: this.generateToolCallId()
                });
              }
            }
            if (toolCalls.length > 0) {
              return toolCalls;
            }
          }
        } catch (e) {
          const details = e instanceof Error ? e.stack || e.message : String(e);
          verboseLogger.logMessage(`[Orchestrator] Failed to parse tool array: ${details}`, 'error');
        }
      }

      let bracketCount = 0;
      let startIndex = -1;
      const potentialObjects: string[] = [];

      for (let i = 0; i < jsonContent.length; i++) {
        if (jsonContent[i] === '{') {
          if (bracketCount === 0) {
            startIndex = i;
          }
          bracketCount++;
        } else if (jsonContent[i] === '}') {
          bracketCount--;
          if (bracketCount === 0 && startIndex !== -1) {
            const obj = jsonContent.substring(startIndex, i + 1);
            if (obj.includes('"tool"')) {
              potentialObjects.push(obj);
            }
            startIndex = -1;
          }
        }
      }

      for (const objStr of potentialObjects) {
        try {
          const parsed = JSON.parse(objStr);

          if (parsed.tool && typeof parsed.tool === 'string') {
            toolCalls.push({
              toolName: parsed.tool,
              parameters: parsed.parameters || {},
              id: this.generateToolCallId()
            });
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      const details = e instanceof Error ? e.stack || e.message : String(e);
      verboseLogger.logMessage(`[Orchestrator] Tool extraction error: ${details}`, 'error');
    }

    return toolCalls;
  }

  private generateToolCallId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getContext(): AgentContext {
    return this.state.context;
  }

  resetContext(): void {
    this.state.context.conversationHistory = [];
    this.state.toolResults.clear();
    this.state.executionHistory = [];
  }

  setContext(context: Partial<AgentContext>): void {
    this.state.context = { ...this.state.context, ...context };
  }

  async analyzeIntention(request: string, agentId?: string): Promise<any> {
    const targetAgentId = agentId || this.config.defaultAgent || this.state.currentAgent;
    const agent = this.agents.get(targetAgentId);

    if (!agent) {
      throw new Error(`Agent ${targetAgentId} not found`);
    }

    return await this.intentionDetector.analyzeIntent(request, agent.availableTools);
  }

  async createExecutionPlan(request: string, agentId?: string): Promise<ExecutionPlan> {
    const intention = await this.analyzeIntention(request, agentId);
    const toolSchemas = this.toolRegistry.getAllToolSchemas();
    return await this.taskPlanner.createPlan(request, intention, toolSchemas);
  }
}