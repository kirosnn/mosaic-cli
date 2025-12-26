export interface Shortcut {
  key: string;
  description: string;
  action: string;
}

export interface Command {
  name: string;
  description: string;
  action: string;
}

export const shortcuts: Shortcut[] = [
  { key: 'Ctrl+C', description: 'Exit application (press twice)', action: 'exit' },
  { key: 'Ctrl+L', description: 'Clear screen', action: 'clear' },
  { key: 'Ctrl+U', description: 'Clear input', action: 'clear-input' },
  { key: 'Tab', description: 'Autocomplete', action: 'autocomplete' },
];

export const commands: Command[] = [
  { name: '/theme', description: 'Change theme', action: 'theme' },
  { name: '/provider', description: 'Change provider', action: 'provider' },
  { name: '/model', description: 'Change model', action: 'model' },
  { name: '/verbose', description: 'Toggle verbose mode', action: 'verbose' },
  { name: '/init', description: 'Create MOSAIC.md for workspace', action: 'init' },
  { name: '/undo', description: 'Undo to previous message', action: 'undo' },
  { name: '/redo', description: 'Redo previously undone messages', action: 'redo' },
  { name: '/apikey', description: 'Configure or update API keys for providers', action: 'apikey' },
  { name: '/ide', description: 'Interact with running IDEs', action: 'ide' },
];