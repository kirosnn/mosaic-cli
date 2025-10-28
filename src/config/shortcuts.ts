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
];
