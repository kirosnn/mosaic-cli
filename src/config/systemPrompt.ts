import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MOSAIC_DIR, ensureMosaicDir } from './paths.js';
import { homedir, platform, arch } from 'os';

const SYSTEM_PROMPT_FILE = join(MOSAIC_DIR, 'system-prompt.md');

const DEFAULT_SYSTEM_PROMPT = `You are Mosaic, an AI agent CLI tool created by Kirosnn and published as open source.
You are currently running on {{PLATFORM}}.

Current session:
 - Date: {{DATE}}
 - Time: {{TIME}}
 - Working directory (Workspace): {{CWD}}

---`;

interface PlaceholderValues {
  DATE: string;
  TIME: string;
  DATETIME: string;
  PLATFORM: string;
  ARCH: string;
  USER: string;
  HOME: string;
  CWD: string;
  YEAR: string;
  MONTH: string;
  DAY: string;
  HOUR: string;
  MINUTE: string;
  SECOND: string;
  WEEKDAY: string;
}

function getPlaceholderValues(): PlaceholderValues {
  const now = new Date();

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    DATE: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    TIME: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    DATETIME: now.toLocaleString('en-US'),
    PLATFORM: platform(),
    ARCH: arch(),
    USER: process.env.USERNAME || process.env.USER || 'Unknown',
    HOME: homedir(),
    CWD: process.cwd(),
    YEAR: now.getFullYear().toString(),
    MONTH: months[now.getMonth()],
    DAY: now.getDate().toString().padStart(2, '0'),
    HOUR: now.getHours().toString().padStart(2, '0'),
    MINUTE: now.getMinutes().toString().padStart(2, '0'),
    SECOND: now.getSeconds().toString().padStart(2, '0'),
    WEEKDAY: days[now.getDay()]
  };
}

function replacePlaceholders(content: string): string {
  const values = getPlaceholderValues();
  let result = content || '';

  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }

  return result;
}

export function getSystemPromptPath(): string {
  return SYSTEM_PROMPT_FILE;
}

export function loadSystemPrompt(): string {
  ensureMosaicDir();

  if (!existsSync(SYSTEM_PROMPT_FILE)) {
    writeFileSync(SYSTEM_PROMPT_FILE, DEFAULT_SYSTEM_PROMPT, 'utf-8');
    return replacePlaceholders(DEFAULT_SYSTEM_PROMPT);
  }

  try {
    const content = readFileSync(SYSTEM_PROMPT_FILE, 'utf-8');

    if (!content || content.trim() === '') {
      console.warn('Warning: system-prompt.md is empty, using default prompt');
      return replacePlaceholders(DEFAULT_SYSTEM_PROMPT);
    }

    return replacePlaceholders(content.trim());
  } catch (error) {
    console.error('Error reading system prompt file:', error);
    console.warn('Using default system prompt');
    return replacePlaceholders(DEFAULT_SYSTEM_PROMPT);
  }
}

export function saveSystemPrompt(content: string): void {
  ensureMosaicDir();

  try {
    if (!content || content.trim() === '') {
      throw new Error('System prompt cannot be empty');
    }

    writeFileSync(SYSTEM_PROMPT_FILE, content, 'utf-8');
  } catch (error) {
    console.error('Error saving system prompt file:', error);
    throw error;
  }
}

export function resetSystemPrompt(): void {
  ensureMosaicDir();
  writeFileSync(SYSTEM_PROMPT_FILE, DEFAULT_SYSTEM_PROMPT, 'utf-8');
}

export function hasCustomSystemPrompt(): boolean {
  if (!existsSync(SYSTEM_PROMPT_FILE)) {
    return false;
  }

  try {
    const content = readFileSync(SYSTEM_PROMPT_FILE, 'utf-8');
    return content.trim() !== DEFAULT_SYSTEM_PROMPT.trim();
  } catch {
    return false;
  }
}

export function getAvailablePlaceholders(): string[] {
  return Object.keys(getPlaceholderValues());
}

export function previewPlaceholders(): Record<string, string> {
  const values = getPlaceholderValues();
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    result[key] = value;
  }

  return result;
}
