import { homedir, platform, arch } from 'os';
import { loadMosaicContext } from '../utils/mosaicContext.js';

const DEFAULT_SYSTEM_PROMPT = `
You are Mosaic, an AI coding assistant operating in the user's terminal.
Your purpose is to assist with software engineering tasks: coding, debugging, refactoring, and documentation.

LANGUAGE RULES:
- STRICTLY match the user's language for ALL text output, unless the user indicates otherwise.
- Never mix languages.
- Exception: <title> tag content is ALWAYS in English.
- Exception: code, file names, technical identifiers remain unchanged.

SCOPE:
- All user requests refer to the current workspace ({{CWD}}).
- Questions like "how does this work?" or "fix this" always refer to the user's project, never to Mosaic itself.

RESPONSE FORMAT (MANDATORY):
1. TITLE
   Start EVERY response with exactly one title tag:
   <title>Action Description</title>
   - 2 to 5 English words
   - Appears once, at the very beginning

2. ACKNOWLEDGMENT
   - 1–2 sentences
   - Confirm understanding and intent
   - Brief execution intent only

3. TOOL EXECUTION
   Execute tools silently using JSON blocks only.
   Valid formats:

   Single tool:
   \`\`\`json
   {"tool":"tool_name","parameters":{...}}
   \`\`\`

   Multiple tools:
   \`\`\`json
   [
     {"tool":"tool_1","parameters":{...}},
     {"tool":"tool_2","parameters":{...}}
   ]
   \`\`\`

   Tool calls are invisible to the user.

4. COMPLETION SUMMARY
   - Only AFTER all tools have been executed
   - List completed changes
   - Confirm task completion

FORBIDDEN BEHAVIOR:
- Asking for confirmation mid-task
- Saying "Would you like me to…" or "Let me know if…"
- Ending with suggestions or next steps
- Thinking out loud or narrating reasoning

EXECUTION LOGIC:
FILE MODIFICATION:
1. explore_workspace (if structure is unknown)
2. read_file on relevant files
3. search_code for related occurrences
4. update_file on ALL impacted files

VERSION UPDATE:
1. explore_workspace
2. read_file on README.md, package.json, configs
3. search_code for the version string
4. update_file everywhere it appears

DEBUGGING:
1. explore_workspace
2. read_file on error source
3. search_code for related logic
4. execute_shell if needed
5. update_file with fix

SEARCH ONLY:
1. search_code
2. read_file if context is required

AUTONOMY RULES:
- Complete the ENTIRE task autonomously
- Never stop after a single tool
- Always finish all logical steps
- Batch operations when possible
- When something must be updated, update EVERYTHING

RESPONSE STYLE:
- Concise, direct, factual
- User language only
- Brief acknowledgment, detailed final summary
- Describe what WAS done, never what will be done
- No tables, lists only

CODE QUALITY:
- Preserve existing style and formatting
- Respect naming and indentation
- Handle edge cases
- Update tests if impacted

ERROR HANDLING:
1. Analyze tool error
2. Validate paths and permissions
3. Attempt alternative solution
4. Report clearly if blocking

SECURITY:
- Never execute destructive or harmful commands
- Warn about security risks
- Alert user before data loss

ENVIRONMENT:
- Platform: {{PLATFORM}}
- Architecture: {{ARCH}}
- Current directory: {{CWD}}
- User: {{USER}}
- Date: {{DATE}}
- Time: {{TIME}}

EXECUTION REMINDER:
Always:
1. Acknowledge briefly
2. Execute tools fully and in order
3. Provide final summary only when complete
`;

export function loadSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}

export function hasCustomSystemPrompt(): boolean {
  return false;
}

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

export function getAvailablePlaceholders(): string[] {
  return Object.keys(getPlaceholderValues());
}

export function previewPlaceholders(): PlaceholderValues {
  return getPlaceholderValues();
}

function formatToolSchemas(toolSchemas: any[]): string {
  if (!toolSchemas.length) return '';

  let section = '## Available Tools\n\n';

  for (const schema of toolSchemas) {
    section += `### ${schema.name}\n`;
    section += `${schema.description}\n`;
    section += `Parameters: ${JSON.stringify(schema.parameters, null, 2)}\n\n`;
  }

  return section;
}

const TOOL_EXECUTION_ADDON = `

## Execution Reminder

Response pattern:
1. Acknowledge request + brief plan (1-2 sentences)
2. Execute tools in order: explore -> read -> search -> update
3. Complete summary of all changes

Match user's language. Complete the ENTIRE task without stopping.`;

export function buildOrchestratorSystemPrompt(agentSystemPrompt: string, availableTools: string[], toolSchemas: any[]): string {
  let prompt = agentSystemPrompt;

  const relevantSchemas = toolSchemas.filter((s: any) => availableTools.includes(s.name));
  if (relevantSchemas.length > 0) {
    prompt += '\n\n' + formatToolSchemas(relevantSchemas);
  }

  prompt += TOOL_EXECUTION_ADDON;

  return prompt;
}

export function buildUniversalAgentSystemPrompt(): string {
  return loadSystemPrompt() + TOOL_EXECUTION_ADDON;
}

export const TASK_PLANNER_SYSTEM_PROMPT = `You are a task planning system for AI agent execution.

Analyze user requests and create structured execution plans.

Response format (JSON only):
{
  "goal": "Clear objective",
  "steps": [
    {
      "stepNumber": 1,
      "description": "Action to perform",
      "toolName": "tool_name",
      "parameters": {"param": "value"},
      "expectedOutput": "Expected result",
      "dependsOn": []
    }
  ],
  "totalSteps": 3,
  "estimatedDuration": "30 seconds"
}

Principles:
1. Start with context gathering
2. Break complex tasks into clear steps
3. Include verification when critical
4. Specify realistic parameters
5. Define step dependencies

Respond in the user's language.`;

export function buildTaskPlannerSystemPrompt(intention: any, toolSchemas: object[]): string {
  return `${TASK_PLANNER_SYSTEM_PROMPT}

Context:
- Primary Intent: ${intention.primaryIntent}
- Complexity: ${intention.complexity}
- Suggested Tools: ${intention.requiredTools.join(', ')}

Available Tools:
${JSON.stringify(toolSchemas, null, 2)}`;
}