export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>, context: AgentContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AgentContext {
  conversationHistory: Message[];
  workingDirectory: string;
  environment: Record<string, string>;
  metadata: Record<string, any>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  timestamp: Date;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  id: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  availableTools: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface OrchestratorConfig {
  defaultAgent?: string;
  maxIterations: number;
  enableToolChaining: boolean;
  toolTimeout: number;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  estimatedDuration?: number;
}

export interface ExecutionStep {
  action: 'tool_call' | 'agent_response' | 'user_input';
  toolName?: string;
  parameters?: Record<string, any>;
  agentId?: string;
}

export interface OrchestratorState {
  currentAgent: string;
  executionHistory: ExecutionStep[];
  toolResults: Map<string, ToolResult>;
  context: AgentContext;
}
