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

export type OrchestratorEventType =
  | 'iteration_start'
  | 'ai_thinking'
  | 'ai_response'
  | 'ai_stream_start'
  | 'ai_stream_delta'
  | 'ai_stream_complete'
  | 'ai_stream_error'
  | 'tool_call_detected'
  | 'tool_executing'
  | 'tool_success'
  | 'tool_error'
  | 'final_response'
  | 'error';

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  timestamp: Date;
  data?: any;
}

export type OrchestratorEventListener = (event: OrchestratorEvent) => void;