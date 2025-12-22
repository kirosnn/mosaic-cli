# MOSAIC.md

## Project Overview
Mosaic CLI is a command-line interface for interacting with large language models directly from the terminal. It supports multiple AI providers (Ollama, OpenAI) and provides a React-based TUI (Terminal User Interface) using Ink. The application is designed to assist with code-related tasks and workflow integration.

## High-Level Architecture
The application follows a component-based architecture with React at its core, rendered in the terminal using Ink. The main execution flow involves:
1. Terminal initialization and configuration setup
2. AI provider integration and model management
3. Interactive chat interface for user-AI communication
4. Workspace context handling for directory-aware operations

## Entry Points and Runtime Flow
- **Main Entry**: `src/index.tsx` - Handles CLI arguments, workspace directory resolution, and initializes the React application
- **Runtime Flow**:
  1. Parse command-line arguments for target directory
  2. Validate and change to the specified workspace directory
  3. Initialize configuration and ensure required directories exist
  4. Update AI providers with latest available models
  5. Render the main React component (`App`) using Ink
  6. Manage terminal UI lifecycle with proper cleanup

## Development Commands
- `npm run build`: Compile TypeScript to JavaScript (output to `dist/`)
- `npm run dev`: Run development server with TSX loader
- `npm run start`: Execute compiled application from `dist/`
- `npm run watch`: Watch mode for TypeScript compilation
- `npm run update-models`: Update AI model configurations
- `npm run test:system-prompt`: Run system prompt integrity tests

## Project Structure
- `src/`: Main application source code
  - `components/`: React components for terminal UI
  - `config/`: Configuration management and providers
  - `hooks/`: Custom React hooks
  - `orchestrator/`: Core application logic
  - `services/`: External service integrations
  - `types/`: TypeScript type definitions
  - `utils/`: Utility functions
- `config/`: Application configuration files
- `scripts/`: Maintenance and utility scripts
- `tests/`: Test suites
- `dist/`: Compiled output directory

## Key Files
- `src/index.tsx`: Main entry point and CLI argument handling
- `src/components/App.tsx`: Root React component managing application state and views
- `src/config/index.js`: Configuration loading and validation
- `src/config/providers.js`: AI provider management and model updates
- `src/utils/terminalUtils.js`: Terminal manipulation utilities
- `tsconfig.json`: TypeScript configuration with React support
- `package.json`: Project metadata and dependencies

## Dependencies
- **Runtime**:
  - `ink`: React for interactive terminal applications
  - `ink-big-text`, `ink-gradient`, `ink-markdown`, `ink-spinner`, `ink-text-input`: Ink UI components
  - `ollama`, `openai`: AI provider SDKs
  - `marked`: Markdown parsing
  - `chalk`: Terminal styling
  - `react`: Core React library

- **Development**:
  - `typescript`: TypeScript compiler
  - `ts-node`, `tsx`: TypeScript execution environments
  - `@types/node`, `@types/react`: Type definitions

## Conventions and Assumptions
- **Language**: TypeScript with React (ES2022 target)
- **Module System**: ES Modules (`"type": "module"`)
- **Configuration**: JSON-based configuration with runtime validation
- **Workspace Handling**: Application can be launched in specific directories for context-aware operations
- **Terminal UI**: Uses Ink's React-based rendering system
- **Error Handling**: Graceful degradation with terminal feedback
- **State Management**: React hooks for component state

## Extension and Modification Notes
- **Safe to Extend**:
  - Adding new AI providers in `src/config/providers.js`
  - Creating new UI components in `src/components/`
  - Adding utility functions in `src/utils/`
  - Extending configuration options in `src/config/`

- **Sensitive Areas**:
  - Core React rendering in `src/index.tsx`
  - Main application state management in `src/components/App.tsx`
  - TypeScript configuration in `tsconfig.json`
  - Build scripts and compilation settings

The application is designed for modular extension, particularly around AI provider integrations and UI components. Configuration management is centralized, making it straightforward to add new features while maintaining existing functionality.