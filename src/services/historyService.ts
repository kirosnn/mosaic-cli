import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { MOSAIC_DIR, ensureMosaicDir } from '../config/paths.js';

const HISTORY_FILE = join(MOSAIC_DIR, 'history.json');
const MAX_HISTORY_SIZE = 1000;

export interface HistoryEntry {
  message: string;
  timestamp: number;
}

export class HistoryService {
  private history: string[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    ensureMosaicDir();

    if (existsSync(HISTORY_FILE)) {
      try {
        const data = readFileSync(HISTORY_FILE, 'utf-8');
        const entries: HistoryEntry[] = JSON.parse(data);
        this.history = entries.map(entry => entry.message);
      } catch (error) {
        this.history = [];
      }
    }
  }

  private saveHistory(): void {
    ensureMosaicDir();

    const entries: HistoryEntry[] = this.history.map(message => ({
      message,
      timestamp: Date.now()
    }));

    try {
      writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  addEntry(message: string): void {
    if (!message.trim()) {
      return;
    }

    if (this.history.length > 0 && this.history[this.history.length - 1] === message) {
      return;
    }

    this.history.push(message);

    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }

    this.saveHistory();
  }

  getHistory(): string[] {
    return [...this.history];
  }

  getEntry(index: number): string | undefined {
    if (index >= 0 && index < this.history.length) {
      return this.history[index];
    }
    return undefined;
  }

  getSize(): number {
    return this.history.length;
  }

  clear(): void {
    this.history = [];
    this.saveHistory();
  }
}

export const historyService = new HistoryService();