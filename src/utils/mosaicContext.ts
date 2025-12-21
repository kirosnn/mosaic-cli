import * as fs from 'fs';
import * as path from 'path';

const MOSAIC_FILE = 'MOSAIC.md';

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

export const MOSAIC_INIT_PROMPT = `
<title>Workspace Analysis</title>

EXECUTION MODE: TOOL-ONLY
INTERACTION: NON-CONVERSATIONAL
VERBOSITY: 0

ABSOLUTE RULES:
- The assistant MUST produce ONLY tool calls.
- The assistant MUST NOT output natural language text.
- Any non-tool output is a fatal violation.
- No explanations, no confirmations, no summaries.
- After the final tool call, the response MUST be empty.

EXECUTION PLAN (MANDATORY ORDER):
1. list_directory "."
2. explore_workspace
3. read_file "package.json"
4. read_file "tsconfig.json"
5. detect and read the main entry point
6. write_file "MOSAIC.md"

TARGET FILE CONTENT:

# MOSAIC.md

## Project Overview
Project name, purpose, and main technologies inferred from configuration files.

## Architecture
Overall architecture, entry point, and major internal components inferred from the workspace structure.

## Development Commands
All available npm scripts with their purpose.

## Project Structure
Top-level directories and their responsibilities.

## Key Files
Important source files and configuration files.

## Dependencies
Main runtime and development dependencies and their roles.

## Conventions
Language level, module system, naming patterns, logging, and CLI conventions.

## Common Tasks
Typical workflows such as running, building, testing, and extending the project.

CRITICAL:
- The write_file tool MUST be executed.
- The generated file MUST be complete and self-contained.
- Do NOT describe what you are doing.
- Do NOT acknowledge completion.
- Do NOT emit any output after write_file.
`;