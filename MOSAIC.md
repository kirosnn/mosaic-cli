# MOSAIC.md

## Project Overview

Mosaic is an AI-powered terminal CLI that provides a React-based interface for real-time interaction with large language models. It serves as a multi-provider client supporting OpenAI, Anthropic, OpenRouter, Ollama, and any OpenAI-compatible API. The core value proposition is conversational AI with terminal-native markdown rendering, file context injection, IDE detection, and state snapshots for undo/redo functionality.

## High-Level Architecture

Mosaic follows a component-driven architecture with clear separation of concerns:

**Rendering Layer**: React components rendered to terminal via Ink (React for CLI). The App component orchestrates all UI state and interactions.

**Control Layer**: Orchestrator module manages conversation flow, system prompt execution, and context resolution. This layer bridges user input to AI operations.

**Integration Layer**: Services handle external dependencies (OpenAI SDK, Ollama HTTP, IDE detection, file system operations). Providers abstract away API differences.

**Configuration Layer**: Local configuration management including API key encryption, provider setup, formatting preferences, and dynamic system prompt resolution.

Data flows unidirectionally: CLI input → orchestrator → services/config → AI response → React state → terminal render.

## Entry Points and Runtime Flow

**Primary Entry**: `src/index.tsx`

1. Node.js shebang allows direct execution as CLI binary
2. Parses CLI arguments: `--help`, `--verbose`, optional target directory
3. Validates or creates Mosaic config directory via `ensureMosaicDir()`
4. Updates provider models with `updateProvidersWithLatestModels()`
5. Clears terminal and sets window title
6. Renders the `App` component via Ink's `render()` function
7. App component establishes connection to selected AI provider and begins conversation loop

The application runs as a persistent interactive session until user exit. Verbose mode enables detailed execution logging.

## Development Commands

| Command | Purpose | Context |
| --- | --- | --- |
| `npm run build` | TypeScript compilation to dist/ | Before distribution or testing |
| `npm run dev` | Run with ts-node directly (skip build) | Development iteration |
| `npm run watch` | Continuous TypeScript compilation | Parallel to dev testing |
| `npm start` | Execute compiled dist/index.js | Production/packaged execution |
| `npm run update-models` | Fetch latest models from providers | Fallback model inventory sync |
| `npm run test:system-prompt` | Benchmark system prompt integrity | CI/validation of prompt consistency |

## Project Structure

**src/components** - React components for terminal UI
- App: Root component managing session state
- Input/Output/History components for conversation rendering

**src/config** - Configuration initialization and provider setup
- Handles API key encryption/retrieval
- Provider registry and model updates
- Directory structure initialization

**src/hooks** - Custom React hooks
- State management for conversation, settings, context
- Effects for external API calls and file watching

**src/orchestrator** - Main conversation control logic
- Prompt assembly with context injection
- System prompt template resolution
- Conversation state transitions

**src/services** - External integrations
- OpenAI, Ollama, and other provider clients
- IDE detection (VSCode, Cursor, Windsurf)
- File system operations (read, write, snapshot management)

**src/types** - TypeScript definitions
- Provider configuration schemas
- Conversation message structures
- Context reference types

**src/utils** - Helper utilities
- Terminal control (title, clear, cursor management)
- String formatting and markdown utilities
- Path resolution

**config/formatting.json** - Markdown rendering rules for terminal output (syntax highlighting, indentation)

**scripts/updateModelsFallback.ts** - Utility to sync provider model lists from APIs

## Key Files

| File | Role |
| --- | --- |
| `src/index.tsx` | CLI entry point, argument parsing, session initialization |
| `src/components/App.tsx` | Root React component, conversation state, message loop |
| `src/orchestrator/executor.ts` | Prompt assembly, context injection, AI request orchestration |
| `src/config/providers.ts` | Provider abstraction, model registry, API initialization |
| `src/services/fileService.ts` | Context reference resolution, snapshot persistence |
| `src/hooks/useConversation.ts` | Conversation state and effects |
| `src/utils/terminalUtils.ts` | Terminal control primitives |
| `config/formatting.json` | Terminal markdown rendering configuration |
| `tsconfig.json` | Strict TypeScript with JSX and source maps |
| `package.json` | Dependencies (Ink, OpenAI SDK, Ollama client, React 19+) |

## Dependencies

**Runtime**:
- `ink` (^6.4.0) - React for terminal UIs. Core rendering engine for all UI components.
- `ink-*` family - Specialized Ink components for spinner, text input, markdown, big text, gradient.
- `react` (>=19.0.0) - Component framework. Strict mode enforced for development safety.
- `openai` (^6.7.0) - OpenAI SDK. Handles ChatGPT, GPT-4, and compatible API clients.
- `ollama` (^0.6.2) - Ollama client for local LLM inference over HTTP.
- `marked` (^16.4.1) - Markdown parser for rendering and syntax analysis.
- `chalk` (^5.6.0) - Terminal color utilities, used sparingly with Ink's native theming.

**Dev**:
- `typescript` (^5.0.0) - Strict mode, JSX support (React factory pattern).
- `ts-node` (^10.9.0) - Direct TypeScript execution for dev mode.
- `tsx` (^4.21.0) - ESM-aware TypeScript executor for scripts.
- `@types/node`, `@types/react` - Type definitions for runtime environments.

## Conventions and Assumptions

**Language & Module System**:
- ES2022 target with ESNext module output (native ES modules only)
- `.tsx` extension for React components, `.ts` for utilities and services
- Strict TypeScript with `noImplicitAny` and full type coverage expected

**File Context Injection**:
- User references files/directories with `#path/to/file` syntax
- Orchestrator resolves relative paths from target directory (CLI argument or cwd)
- Context is embedded into system prompts at request time

**Provider Configuration**:
- API keys stored encrypted in ~/.mosaic/keys (platform-dependent paths)
- Provider selection stored in config file, fallback to Ollama localhost
- Model lists cached locally and updated via `update-models` script

**System Prompts**:
- Markdown files with `{{placeholder}}` syntax for dynamic values
- Placeholders resolved at runtime (project context, file contents, user metadata)
- Custom prompts override defaults from config/

**IDE Integration**:
- Auto-detects VSCode, Cursor, Windsurf instances running in parent processes
- Allows opening files directly in detected IDE from CLI
- Windows-only detection for some IDE variants

**Snapshot/Undo System**:
- File modifications tracked per conversation message
- Snapshots stored in .mosaic/snapshots/ with conversation ID
- Redo recreates exact state by reapplying modifications in order

**Logging**:
- Verbose flag (`--verbose`, `-v`) enables detailed execution logs
- Terminal title updates reflect current state (status, provider, model)

## Extension and Modification Notes

**Safe to Extend**:
- **New UI components**: Add to `src/components/`. Ink component library is stable and well-documented.
- **New AI providers**: Extend `src/config/providers.ts` with new provider class. Implement `send(prompt, model)` interface.
- **New services**: Add to `src/services/`. Services should be stateless and composable.
- **Custom hooks**: Add to `src/hooks/` for shared state or effect logic.
- **Utility functions**: Add to `src/utils/` for reusable terminal or string operations.
- **Formatting rules**: Modify `config/formatting.json` for terminal markdown rendering without code changes.

**Sensitive Areas**:
- **src/orchestrator**: Controls prompt assembly and context injection. Changes affect all AI interactions. Requires testing against system prompts.
- **src/config**: Encryption keys and provider initialization. Changes can break API connections or expose credentials.
- **index.tsx**: CLI argument parsing and initialization order. Missteps break entry point or state setup.
- **snapshot logic**: File modification tracking and reapplication. Errors can cause data loss or state corruption.

**Common Modifications**:
- Adjust terminal colors/themes: Modify Ink component props or create theme configuration
- Add new CLI flags: Extend argument parsing in index.tsx and pass to App context
- Change default provider: Update config initialization in `src/config/index.ts`
- Customize system prompt behavior: Edit markdown templates in config/prompts/ directory
- Add new context types: Extend service layer in `src/services/fileService.ts` and type definitions in `src/types/`
