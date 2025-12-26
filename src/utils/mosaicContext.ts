import * as fs from 'fs';
import * as path from 'path';
import { verboseLogger } from './VerboseLogger.js';

const MOSAIC_FILE = 'MOSAIC.md';
const MOSAIC_CONFIG_FILE = 'mosaic.jsonc';

export interface WorkspaceConfig {
  workspaceRoot?: string;
  enablePlanning?: boolean;
  requestsPerSecond?: number;
}

export function loadMosaicContext(workingDirectory?: string): string | null {
  try {
    const cwd = workingDirectory || process.cwd();
    const mosaicPath = path.join(cwd, MOSAIC_FILE);

    if (!fs.existsSync(mosaicPath)) {
      return null;
    }

    const content = fs.readFileSync(mosaicPath, 'utf-8');
    return content;
  } catch (error) {
    return null;
  }
}

export function getMosaicFilePath(workingDirectory?: string): string {
  const cwd = workingDirectory || process.cwd();
  return path.join(cwd, MOSAIC_FILE);
}

export function getWorkspaceConfigPath(workingDirectory?: string): string {
  const cwd = workingDirectory || process.cwd();
  return path.join(cwd, MOSAIC_CONFIG_FILE);
}

export function loadWorkspaceConfig(workingDirectory?: string): WorkspaceConfig {
  try {
    const configPath = getWorkspaceConfigPath(workingDirectory);

    if (!fs.existsSync(configPath)) {
      return {};
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const cleanedContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(cleanedContent) as WorkspaceConfig;
    return config;
  } catch (error) {
    return {};
  }
}

export function saveWorkspaceConfig(config: WorkspaceConfig, workingDirectory?: string): void {
  try {
    const configPath = getWorkspaceConfigPath(workingDirectory);
    const cwd = workingDirectory || process.cwd();

    const fullConfig: WorkspaceConfig = {
      workspaceRoot: config.workspaceRoot || cwd,
      ...config
    };

    const lines: string[] = ['{'];
    const entries: string[] = [];

    if (fullConfig.workspaceRoot) {
      entries.push(`  "workspaceRoot": ${JSON.stringify(fullConfig.workspaceRoot)}`);
    }

    if (fullConfig.enablePlanning !== undefined) {
      entries.push(`  "enablePlanning": ${fullConfig.enablePlanning}`);
    }

    if (fullConfig.requestsPerSecond !== undefined) {
      entries.push(`  "requestsPerSecond": ${fullConfig.requestsPerSecond}`);
    }

    lines.push(entries.join(',\n'));
    lines.push('}');
    lines.push('');

    fs.writeFileSync(configPath, lines.join('\n'), 'utf-8');
  } catch (error) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    verboseLogger.logMessage(`Failed to save workspace config: ${details}`, 'error');
  }
}

export const MOSAIC_INIT_PROMPT = `
<title>Workspace Analysis</title>

EXECUTION MODE: CONTROLLED-ANALYSIS
INTERACTION: NON-CONVERSATIONAL
VERBOSITY: 0

ROLE:
You are an autonomous codebase analyst.
Your goal is to produce a high-signal, pedagogical, and strategic document
that allows a future AI agent to understand and operate this repository efficiently.

ABSOLUTE RULES:
- The final response MUST contain exactly one write_file tool call.
- The target file MUST be MOSAIC.md.
- No conversational language.
- No confirmations, no apologies, no meta commentary.
- Do NOT describe the analysis process.
- Do NOT emit any output after the write_file call.
- If the file already exists, offer the user the option to improve it or delete it to start a new one.

FORBIDDEN ACTIONS:
- You MUST NOT execute shell commands.
- You MUST NOT run npm, node, or any build/start/test scripts.
- You MUST NOT attempt to validate the project by execution.
- This task is STATIC ANALYSIS ONLY.

ALLOWED BEHAVIOR:
- You MAY choose which files are relevant beyond the mandatory ones.
- You MAY ignore files or directories with low signal.
- You MAY infer architecture and workflows when supported by evidence.
- You MUST avoid obvious, generic, or low-value statements.

MANDATORY ANALYSIS STEPS:
1. list_directory "."
2. explore_workspace (use default parameters for minimal token usage)
3. read_file "package.json" (limit: 50) if present
4. read_file "tsconfig.json" (limit: 30) if present
5. detect and read the main entry point (limit: 50)
6. read any additional high-signal files if needed (limit: 30 each)
7. write_file "MOSAIC.md"

TOKEN OPTIMIZATION:
- Use limit parameter on read_file to read only the most relevant lines
- Use explore_workspace with DEFAULT parameters (minimal mode, low token cost)
- Prioritize breadth over depth: read multiple files partially rather than few files completely
- You are allowed to read 5 files at most.

DOCUMENT OBJECTIVE:
MOSAIC.md must be a pedagogical and strategic reference.
It should explain not only what exists, but why it exists and how it fits together.
Assume the reader is an AI agent that needs to become productive quickly.

TARGET FILE CONTENT:

# MOSAIC.md

## Project Overview
Concise description of the project purpose, domain, and main technologies.
Avoid marketing language.

## High-Level Architecture
Big-picture architecture inferred from the codebase.
Describe the main execution flow and responsibility boundaries.

## Entry Points and Runtime Flow
How the application starts and how control flows at runtime.
Mention important initialization steps.

## Development Commands
Only commands that are actually useful.
Explain when and why to use them.

## Project Structure
Key directories and their responsibilities.
Ignore trivial or boilerplate folders.

## Key Files
A curated list of the most important files.
Explain their role in one sentence each.

## Dependencies
Only meaningful runtime and development dependencies.
Explain why they matter.

## Conventions and Assumptions
Language level, module system, configuration patterns, logging, CLI behavior,
and any implicit assumptions discovered in the codebase.

## Extension and Modification Notes
Where changes are typically made.
Which parts are safe to extend and which are sensitive.

QUALITY BAR:
- Every section must provide actionable understanding.
- Avoid repetition and filler content.
- Prefer clarity over exhaustiveness.
- The document must be self-contained and future-proof.

ALLOWED TOOLS:
- list_directory
- explore_workspace
- read_file
- write_file (only for creating MOSAIC.md)

CRITICAL:
- The write_file tool MUST be executed.
- MOSAIC.md MUST be complete.
- No output after write_file.
`;