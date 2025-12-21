# Mosaic CLI

Version 0.0.4.31

Mosaic is a command-line interface for interacting with large language models directly from your terminal. It supports multiple AI providers and provides a straightforward way to integrate AI assistance into your workflow.

## Overview

This tool allows you to have conversations with AI models without leaving your terminal. It's useful for getting quick answers, debugging code, generating text, or working with AI models as part of your development process.

The interface is text-based and designed to work in any terminal environment. Responses are formatted as markdown with syntax highlighting for code blocks.

## Key Features

- **Multiple Provider Support**: Connect to OpenAI, Anthropic, OpenRouter, Ollama, or any OpenAI-compatible API
- **Terminal Interface**: Built with React and Ink for a responsive terminal UI
- **Markdown Rendering**: Code blocks, lists, and formatting are properly displayed in the terminal
- **Customizable System Prompts**: Define AI behavior using a markdown file with support for dynamic placeholders
- **Secure Storage**: API keys are encrypted and stored locally
- **Theme Support**: Several color schemes available to match your terminal preferences

## Installation

```bash
npm install -g mosaic-cli
```

Or clone and build from source:

```bash
git clone https://github.com/yourusername/mosaic-cli.git
cd mosaic-cli
npm install
npm run build
npm link
```

## Getting Started

After installation, run:

```bash
mosaic
```

On first run, you'll be guided through a setup process:
1. Select a color theme for the interface
2. Choose your AI provider (OpenAI, Anthropic, etc.)
3. Enter your API key

Once configured, you can start sending messages to the AI model. Type your question or prompt and press Enter to receive a response.

## Configuration

Configuration files are stored in `~/.mosaic/`:

- **config.json** - Main configuration (provider, model, theme settings)
- **.secrets.json** - Encrypted API keys
- **system-prompt.md** - System prompt template

### System Prompt Customization

The system prompt defines how the AI responds to your messages. You can edit `~/.mosaic/system-prompt.md` to change the AI's behavior, tone, or focus.

The prompt template supports dynamic placeholders that are replaced at runtime:

- `{{DATE}}` - Current date
- `{{TIME}}` - Current time
- `{{USER}}` - Your username
- `{{PLATFORM}}` - Operating system
- `{{CWD}}` - Current working directory

Additional placeholders are available for more advanced use cases.

## Supported Providers

### OpenAI
Supports GPT-4o, GPT-4o-mini, GPT-5, and other OpenAI models. Requires an OpenAI API key.

### Anthropic
Supports Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1, and other Claude models. Requires an Anthropic API key.

### OpenRouter
Provides access to various AI models through a single unified API. Requires an OpenRouter API key.

### Ollama
For running models locally on your machine. Requires Ollama to be installed and running on your system.

### Custom Provider
You can configure any OpenAI-compatible API endpoint. This is useful for self-hosted models or alternative providers that implement the OpenAI API specification.

## Keyboard Shortcuts

While using Mosaic, the following keyboard shortcuts are available:

- `?` - Display help for keyboard shortcuts
- `/` - Show list of available commands
- `Ctrl+C` (twice) - Exit the application
- `Ctrl+L` - Clear the current conversation history
- `Ctrl+U` - Clear the current input line

## Development

To work on Mosaic locally:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Watch mode for automatic rebuilds
npm run watch
```

## Technical Details

This project is built with:

- **React + Ink** - For building the terminal user interface
- **TypeScript** - For type safety and better development experience
- **Chalk** - For terminal text styling
- **Node.js** - As the runtime environment

## Contributing

Contributions are welcome. If you find a bug or have a feature request, please open an issue on GitHub. Pull requests are also appreciated.

## License

MIT © kirosnn
