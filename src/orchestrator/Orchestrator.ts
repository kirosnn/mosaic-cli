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
    this.intentionDetector = new IntentionDetector(this.aiProvider);
    this.taskPlanner = new TaskPlanner(this.aiProvider);

    this.config = {
      maxIterations: config.maxIterations ?? 10,
      enableToolChaining: config.enableToolChaining ?? true,
      toolTimeout: config.toolTimeout ?? 30000,
      defaultAgent: config.defaultAgent
    };

    this.state = {
      currentAgent: config.defaultAgent || 'default',
      executionHistory: [],
      toolResults: new Map(),
      context: {
        conversationHistory: [],
        workingDirectory: process.cwd(),
        environment: process.env as Record<string, string>,
        metadata: {}
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
        console.error('[Orchestrator] Error in event listener:', error);
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
      if (!aiResponse.error) {
        const filteredContent = filterToolCallsFromText(accumulated);
        this.emit({
          type: 'ai_stream_complete',
          timestamp: new Date(),
          data: { content: filteredContent }
        });
      } else {
        this.emit({
          type: 'ai_stream_error',
          timestamp: new Date(),
          data: { error: aiResponse.error }
        });
      }

      if (aiResponse.error) {
        this.emit({
          type: 'error',
          timestamp: new Date(),
          data: { error: aiResponse.error }
        });
        throw new Error(`AI Provider error: ${aiResponse.error}`);
      }

      const finalContent = aiResponse.content || accumulated;
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

    for (const msg of this.state.context.conversationHistory) {
      if (msg.role === 'tool') {
        messages.push({
          role: 'user',
          content: this.enrichToolResultMessage(msg)
        });
      } else {
        messages.push({
          role: msg.role,
          content: msg.content
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

      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1].trim();
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
          console.error('[Orchestrator] Failed to parse tool array:', e);
        }
      }

      const jsonObjectMatches = jsonContent.match(/\{[^{}]*"tool"[^{}]*"parameters"[^{}]*\}/g);
      if (jsonObjectMatches) {
        for (const match of jsonObjectMatches) {
          try {
            const parsed = JSON.parse(match);
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
      }

      if (toolCalls.length === 0) {
        const relaxedMatch = jsonContent.match(/\{\s*["']tool["']\s*:\s*["']([^"']+)["']\s*,\s*["']parameters["']\s*:\s*(\{[^}]*\})\s*\}/);
        if (relaxedMatch) {
          try {
            const parsed = {
              tool: relaxedMatch[1],
              parameters: JSON.parse(relaxedMatch[2])
            };
            toolCalls.push({
              toolName: parsed.tool,
              parameters: parsed.parameters,
              id: this.generateToolCallId()
            });
          } catch (e) {
            console.error('[Orchestrator] Relaxed parsing failed:', e);
          }
        }
      }
    } catch (e) {
      console.error('[Orchestrator] Tool extraction error:', e);
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