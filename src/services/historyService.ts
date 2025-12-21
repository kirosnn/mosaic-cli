import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { MOSAIC_DIR, ensureMosaicDir } from '../config/paths.js';
import { ProviderConfig } from '../config/providers.js';

const HISTORY_FILE = join(MOSAIC_DIR, 'history.json');
const MAX_HISTORY_SIZE = 1000;

export interface ToolExecutionHistory {
  name: string;
  status: 'running' | 'completed' | 'error';
  parameters?: any;
  result?: string;
  timestamp: number;
}

export interface HistoryEntry {
  message: string;
  timestamp: number;
  response?: string;
  provider?: {
    type: string;
    model: string;
    baseUrl?: string;
  };
  tools?: ToolExecutionHistory[];
  tokenCount?: number;
  duration?: number;
  success?: boolean;
  error?: string;
}

export class HistoryService {
  private history: HistoryEntry[] = [];
  private inputHistory: string[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    ensureMosaicDir();

    if (existsSync(HISTORY_FILE)) {
      try {
        const data = readFileSync(HISTORY_FILE, 'utf-8');
        const entries: HistoryEntry[] = JSON.parse(data);
        this.history = entries;
        this.inputHistory = entries.map(entry => entry.message);
      } catch (error) {
        this.history = [];
        this.inputHistory = [];
      }
    }
  }

  private saveHistory(): void {
    ensureMosaicDir();

    try {
      writeFileSync(HISTORY_FILE, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  addEntry(entry: string | HistoryEntry): void {
    let historyEntry: HistoryEntry;

    if (typeof entry === 'string') {
      if (!entry.trim()) {
        return;
      }

      if (this.inputHistory.length > 0 && this.inputHistory[this.inputHistory.length - 1] === entry) {
        return;
      }

      historyEntry = {
        message: entry,
        timestamp: Date.now()
      };
    } else {
      if (!entry.message.trim()) {
        return;
      }

      if (this.inputHistory.length > 0 && this.inputHistory[this.inputHistory.length - 1] === entry.message) {
        return;
      }

      historyEntry = {
        ...entry,
        timestamp: entry.timestamp || Date.now()
      };
    }

    this.history.push(historyEntry);
    this.inputHistory.push(historyEntry.message);

    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
      this.inputHistory = this.inputHistory.slice(-MAX_HISTORY_SIZE);
    }

    this.saveHistory();
  }

  updateLastEntry(updates: Partial<HistoryEntry>): void {
    if (this.history.length === 0) {
      return;
    }

    const lastEntry = this.history[this.history.length - 1];
    this.history[this.history.length - 1] = {
      ...lastEntry,
      ...updates
    };

    this.saveHistory();
  }

  getHistory(): HistoryEntry[] {
    return [...this.history];
  }

  getInputHistory(): string[] {
    return [...this.inputHistory];
  }

  getEntry(index: number): string | undefined {
    if (index >= 0 && index < this.inputHistory.length) {
      return this.inputHistory[index];
    }
    return undefined;
  }

  getFullEntry(index: number): HistoryEntry | undefined {
    if (index >= 0 && index < this.history.length) {
      return this.history[index];
    }
    return undefined;
  }

  getSize(): number {
    return this.inputHistory.length;
  }

  clear(): void {
    this.history = [];
    this.inputHistory = [];
    this.saveHistory();
  }
}

export const historyService = new HistoryService();