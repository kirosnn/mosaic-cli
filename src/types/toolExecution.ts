import { Message } from '../services/aiProvider.js';

export interface DiffLine {
  lineNumber: number | null;
  content: string;
  type: 'add' | 'remove' | 'context' | 'empty';
}

export interface ToolExecution {
  name: string;
  displayName: string;
  status: 'running' | 'completed' | 'error';
  result?: string;
  parameters?: Record<string, any>;
  insertAt?: number;
  diffLines?: DiffLine[];
}

export interface MessageWithTools extends Message {
  toolExecutions?: ToolExecution[];
  interrupted?: boolean;
}