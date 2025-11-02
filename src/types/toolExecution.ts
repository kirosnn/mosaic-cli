import { Message } from '../services/aiProvider.js';

export interface ToolExecution {
  name: string;
  displayName: string;
  status: 'running' | 'completed' | 'error';
  result?: string;
  parameters?: Record<string, any>;
  insertAt?: number;
}

export interface MessageWithTools extends Message {
  toolExecutions?: ToolExecution[];
}
