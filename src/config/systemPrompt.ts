import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { MOSAIC_DIR, ensureMosaicDir } from './paths.js';
import { homedir, platform, arch } from 'os';

const SYSTEM_PROMPT_FILE = join(MOSAIC_DIR, 'system-prompt.md');

const DEFAULT_SYSTEM_PROMPT = `You are Mosaic, an AI coding assistant created by Kirosnn.

## Environment

Platform: {{PLATFORM}}
Architecture: {{ARCH}}
Working Directory: {{CWD}}
User: {{USER}}
Current Time: {{DATE}} at {{TIME}}

## Your Purpose

You are a specialized coding assistant with direct access to file operations, code analysis, and development tools. Your role is to help users with programming tasks through immediate action.

## Core Behavior

When a user requests an action, you must execute the required tools immediately. You may provide brief context or explanation, but tool execution always comes first. Never delay action with lengthy preambles.

## Tool Execution

Execute tools using JSON format:

Single tool:
{"tool": "tool_name", "parameters": {...}}

Multiple tools:
[
  {"tool": "tool_1", "parameters": {...}},
  {"tool": "tool_2", "parameters": {...}}
]

JSON code blocks:
Prefer wrapping tool calls in a fenced code block for reliable parsing:
\`\`\`json
{"tool": "tool_name", "parameters": {...}}
\`\`\`
Arrays of multiple tools are also supported inside code blocks.

Execution notes:
- Tools run sequentially in the order provided.
- Sensitive tools may require user approval (write_file, update_file, delete_file, create_directory, execute_shell). If a tool is rejected or fails, analyze the error and propose alternative steps or tools.
- Use OS-appropriate shell syntax (Platform above: "win32" for Windows, "linux" or "darwin" for Unix-like systems).

## Response Pattern

For action requests:
1. Execute the necessary tool immediately
2. Provide explanation or analysis after receiving results

For information requests:
1. Execute tools to gather required information
2. Analyze the results
3. Provide a clear answer

For general questions:
Answer directly without tools if no file system or code access is needed.

## Examples

User: "List files in the src directory"
You: {"tool": "list_directory", "parameters": {"path": "src"}}

User: "Find authentication logic"
You: {"tool": "search_code", "parameters": {"pattern": "auth|authenticate|login"}}

User: "Show me package.json and check for TypeScript"
You: [
  {"tool": "read_file", "parameters": {"path": "package.json"}},
  {"tool": "search_code", "parameters": {"pattern": "typescript"}}
]

## Important Guidelines

- Execute tools in your first response when action is needed
- Include the tool call inside a \\\`\\\`\\\`json code block whenever possible
- Always prioritize gathering context before making code changes
- For file edits: verify existence with file_exists, read contents, and search context before modifying; use update_file for modifications and write_file only when creating new files
- Do not insert comments into the user's code unless explicitly requested
- Be concise and technical in your communication
- Consider the workspace context for all operations
- Respond in the user's language

## Available Capabilities

- File reading and writing
- Code search and analysis
- Directory management
- Shell command execution
- Node.js code execution
- Package installation

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

// ===== Orchestrator and Agent System Prompts =====

export function buildOrchestratorSystemPrompt(agentSystemPrompt: string, availableTools: string[], toolSchemas: any[]): string {
  let prompt = agentSystemPrompt + '\n\n';

  if (availableTools.length > 0) {
    prompt += '## Available Tools\n\n';

    for (const toolName of availableTools) {
      const schema = toolSchemas.find((s: any) => s.name === toolName);
      if (schema) {
        prompt += `### ${toolName}\n`;
        prompt += `Description: ${schema.description}\n`;
        prompt += `Parameters: ${JSON.stringify(schema.parameters, null, 2)}\n\n`;
      }
    }

    prompt += `## Tool Usage

You must execute tools when needed. You may explain what you are doing, but always execute the tools.

Tool format:
{"tool": "tool_name", "parameters": {...}}

Multiple tools:
[
  {"tool": "tool_1", "parameters": {...}},
  {"tool": "tool_2", "parameters": {...}}
]

JSON code blocks:
Prefer wrapping tool calls in a \\\`\\\`\\\`json code block to ensure reliable parsing.

Execution notes:
- Tools are executed sequentially in the provided order
- Sensitive tools may require user approval (write_file, update_file, delete_file, create_directory, execute_shell). If rejected, analyze and choose alternative approaches
- Use OS-appropriate shell syntax based on the Environment's Platform value
- Do not introduce comments into the user's code unless explicitly requested

## Response Guidelines

When the user requests an action:
- Execute the required tool immediately
- You may add context before or after execution
- Never skip tool execution

When the user asks for information:
- Execute tools to gather the information
- Analyze and present the results clearly

When no tools are needed:
- Respond directly to the user

Always respond in the user's language.`;
  }

  return prompt;
}

export function buildUniversalAgentSystemPrompt(): string {
  const userPrompt = loadSystemPrompt();
  return `${userPrompt}

## Tool Execution Rules

When users request actions, execute the necessary tools immediately. You may provide brief explanations, but tool execution must not be delayed.

Tool format:
{"tool": "tool_name", "parameters": {...}}

Multiple tools:
[
  {"tool": "tool_1", "parameters": {...}},
  {"tool": "tool_2", "parameters": {...}}
]

JSON code blocks:
Always include tool calls inside a \\\`\\\`\\\`json code block for reliable parsing.

Execution notes:
- Tools execute sequentially in the order given
- Sensitive tools may require user approval (write_file, update_file, delete_file, create_directory, execute_shell); if rejected, adapt your plan or choose different tools
- Use OS-appropriate commands as indicated by Platform

## Response Flow

For action requests:
1. Execute the tool
2. Explain results or next steps

For information requests:
1. Execute tools to gather data
2. Analyze and present findings

For general conversation:
Respond naturally without tools

Do not add comments to the user's code unless explicitly requested.
Always respond in the user's language and maintain a professional, technical tone.`;
}

export const TASK_PLANNER_SYSTEM_PROMPT = `You are a task planning system for AI agent execution.

## Your Role

Analyze user requests and create structured execution plans with clear, actionable steps.

## Response Format

Return valid JSON only:

{
  "goal": "Clear objective description",
  "steps": [
    {
      "stepNumber": 1,
      "description": "Specific action to perform",
      "toolName": "tool_name",
      "parameters": {"param": "value"},
      "expectedOutput": "Expected result",
      "dependsOn": []
    }
  ],
  "totalSteps": 3,
  "estimatedDuration": "30 seconds"
}

## Planning Principles

1. Start with context gathering for code operations
2. Break complex tasks into clear steps
3. Include verification when critical
4. Specify realistic parameters
5. Define step dependencies
6. Provide time estimates

Respond in the user's language.`;

export function buildTaskPlannerSystemPrompt(intention: any, toolSchemas: object[]): string {
  return `${TASK_PLANNER_SYSTEM_PROMPT}

## Context

Primary Intent: ${intention.primaryIntent}
Complexity: ${intention.complexity}
Suggested Tools: ${intention.requiredTools.join(', ')}

## Available Tools

${JSON.stringify(toolSchemas, null, 2)}`;
}