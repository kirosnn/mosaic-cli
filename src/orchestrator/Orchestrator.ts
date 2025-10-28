import {
  Agent,
  AgentContext,
  Message,
  ToolCall,
  ToolResult,
  OrchestratorConfig,
  ExecutionStep,
  OrchestratorState
} from './types.js';
import { ToolRegistry } from './tools/registry.js';
import { AIProvider } from '../services/aiProvider.js';
import { ProviderConfig } from '../config/providers.js';
import { IntentionDetector } from './planning/IntentionDetector.js';
import { TaskPlanner, ExecutionPlan } from './planning/TaskPlanner.js';

export class Orchestrator {
  private agents: Map<string, Agent> = new Map();
  private toolRegistry: ToolRegistry;
  private aiProvider: AIProvider;
  private config: OrchestratorConfig;
  private state: OrchestratorState;
  private intentionDetector: IntentionDetector;
  private taskPlanner: TaskPlanner;

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

      const messages = this.prepareMessages(agent);
      const aiResponse = await this.aiProvider.sendMessage(messages);

      if (aiResponse.error) {
        throw new Error(`AI Provider error: ${aiResponse.error}`);
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: aiResponse.content,
        timestamp: new Date()
      };

      this.state.context.conversationHistory.push(assistantMsg);

      const toolCalls = this.extractToolCalls(aiResponse.content);

      if (toolCalls.length === 0) {
        finalResponse = aiResponse.content;
        break;
      }

      for (const toolCall of toolCalls) {
        if (!agent.availableTools.includes(toolCall.toolName)) {
          continue;
        }

        const result = await this.toolRegistry.execute(
          toolCall.toolName,
          toolCall.parameters,
          this.state.context,
          this.config.toolTimeout
        );

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
    let enriched = `## Tool Execution Result: ${toolCall.toolName}\n\n`;

    enriched += `### Parameters Used:\n\`\`\`json\n${JSON.stringify(toolCall.parameters, null, 2)}\n\`\`\`\n\n`;

    if (toolResult.success) {
      enriched += `### Status: SUCCESS\n\n`;
      enriched += `### Result Data:\n\`\`\`json\n${JSON.stringify(toolResult.data, null, 2)}\n\`\`\`\n\n`;

      enriched += `### Next Actions:\n`;
      enriched += `- Analyze what this result means for the user's goal\n`;
      enriched += `- If you know all next steps, execute them NOW in one array response\n`;
      enriched += `- Interpret and act on insights, don't just report data\n`;
    } else {
      enriched += `### Status: ERROR\n\n`;
      enriched += `### Error Details:\n${toolResult.error}\n\n`;

      enriched += `### Recovery:\n`;
      enriched += `- Analyze why this failed and what it reveals\n`;
      enriched += `- Try alternative approaches immediately\n`;
      enriched += `- Use other tools to investigate or work around the issue\n`;
    }

    if (toolResult.metadata && Object.keys(toolResult.metadata).length > 0) {
      enriched += `\n### Additional Context:\n\`\`\`json\n${JSON.stringify(toolResult.metadata, null, 2)}\n\`\`\`\n`;
    }

    return enriched;
  }

  private buildSystemPrompt(agent: Agent): string {
    let prompt = agent.systemPrompt + '\n\n';

    if (agent.availableTools.length > 0) {
      prompt += 'You have access to the following tools:\n\n';

      for (const toolName of agent.availableTools) {
        const schema = this.toolRegistry.getToolSchema(toolName);
        if (schema) {
          prompt += `${JSON.stringify(schema, null, 2)}\n\n`;
        }
      }

      prompt += `To use a tool, respond with a JSON object in this format:
{
  "tool": "tool_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}

IMPORTANT: When you need to execute multiple tools to complete a task, use an array format to execute them ALL AT ONCE:
[
  {"tool": "tool_1", "parameters": {...}},
  {"tool": "tool_2", "parameters": {...}},
  {"tool": "tool_3", "parameters": {...}}
]

This allows you to complete tasks in one iteration instead of multiple back-and-forth exchanges.`;
    }

    return prompt;
  }

  private extractToolCalls(response: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    try {
      const arrayMatch = response.match(/\[[\s\S]*"tool"[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item.tool && item.parameters) {
                toolCalls.push({
                  toolName: item.tool,
                  parameters: item.parameters,
                  id: this.generateToolCallId()
                });
              }
            }
            return toolCalls;
          }
        } catch {
        }
      }

      const jsonMatch = response.match(/\{[\s\S]*"tool"[\s\S]*\}/g);

      if (jsonMatch) {
        for (const match of jsonMatch) {
          try {
            const parsed = JSON.parse(match);
            if (parsed.tool && parsed.parameters) {
              toolCalls.push({
                toolName: parsed.tool,
                parameters: parsed.parameters,
                id: this.generateToolCallId()
              });
            }
          } catch {
            continue;
          }
        }
      }
    } catch {
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
