# Mosaic CLI

Mosaic v0.0.3

A modern, AI-powered command-line assistant that brings the power of large language models directly to your terminal.

## What is Mosaic?

Mosaic is a sleek CLI tool that lets you chat with AI directly from your command line. Whether you need coding help, quick answers, or just want to brainstorm ideas, Mosaic makes it simple and fast.

## Features

- **Multiple AI Providers**: Works with OpenAI, Anthropic, OpenRouter, Ollama, and custom providers
- **Beautiful Terminal UI**: Clean, minimal interface built with Ink
- **Markdown Support**: Responses render beautifully with proper formatting, code blocks, and syntax highlighting
- **Customizable System Prompts**: Tailor the AI's behavior to your needs with a simple markdown file
- **Smart Placeholders**: Auto-inject current date, time, user info, and more into your prompts
- **Encrypted Secrets**: API keys are stored securely with encryption
- **Multiple Themes**: Choose a theme that matches your style

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

## Quick Start

1. Run Mosaic for the first time:
   ```bash
   mosaic
   ```

2. Follow the setup wizard to:
   - Choose your theme
   - Select your AI provider
   - Configure your API key

3. Start chatting!

## Configuration

Mosaic stores its configuration in `~/.mosaic/`:

- `config.json` - Main configuration file
- `.secrets.json` - Encrypted API keys
- `system-prompt.md` - Customizable system prompt

### Customizing the System Prompt

Edit `~/.mosaic/system-prompt.md` to customize how the AI behaves. You can use placeholders like:

- `{{DATE}}` - Current date
- `{{TIME}}` - Current time
- `{{USER}}` - Your username
- `{{PLATFORM}}` - Your operating system
- `{{CWD}}` - Current working directory

And many more! Check the full list with `getAvailablePlaceholders()`.

## Supported Providers

### OpenAI
Models: GPT-4o, GPT-4o-mini, GPT-5, and more

### Anthropic
Models: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1

### OpenRouter
Access to various third-party models through a single API

### Ollama
Run models locally with Ollama

### Custom
Bring your own OpenAI-compatible API endpoint

## Keyboard Shortcuts

- `?` - Show keyboard shortcuts
- `/` - Show available commands
- `Ctrl+C` (twice) - Exit
- `Ctrl+L` - Clear conversation
- `Ctrl+U` - Clear input

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Watch mode
npm run watch
```

## Tech Stack

- **React** + **Ink** - Terminal UI framework
- **TypeScript** - Type safety
- **Chalk** - Terminal styling
- **Node.js** - Runtime

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT © kirosnn

## Acknowledgments

Built with love for developers who live in the terminal.
