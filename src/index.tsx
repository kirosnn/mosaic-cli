#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { resolve, isAbsolute } from 'path';
import { statSync } from 'fs';
import App from './components/App.js';
import { ensureMosaicDir, getPackageVersion } from './config/index.js';
import { setTerminalTitle, clearTerminal } from './utils/terminalUtils.js';
import { updateProvidersWithLatestModels } from './config/providers.js';

const args = process.argv.slice(2);
let verboseMode = false;
let targetDirectory: string | null = null;

function showHelp() {
  const version = getPackageVersion();
  console.log(`
Mosaic CLI v${version}
An AI-powered CLI code assistant

Usage:
  mosaic [options] [directory]

Options:
  --help, -h      Show this help message
  --verbose, -v   Enable verbose mode (show detailed execution logs)

Arguments:
  directory       Open Mosaic in the specified directory (optional)

Examples:
  mosaic                    # Start Mosaic in current directory
  mosaic ./my-project       # Start Mosaic in my-project directory
  mosaic --verbose          # Start with verbose mode enabled
  mosaic -v ./my-project    # Start in my-project with verbose mode
  `);
  process.exit(0);
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--help' || arg === '-h') {
    showHelp();
  } else if (arg === '--verbose' || arg === '-v') {
    verboseMode = true;
  } else if (!arg.startsWith('-')) {
    if (targetDirectory === null) {
      targetDirectory = arg;
    }
  }
}

if (targetDirectory) {
  const resolvedPath = isAbsolute(targetDirectory) ? targetDirectory : resolve(process.cwd(), targetDirectory);

  try {
    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      console.error(`mosaic: not a directory: ${targetDirectory}`);
      process.exit(1);
    }

    process.chdir(resolvedPath);
  } catch {
    console.error(`mosaic: directory not found or inaccessible: ${targetDirectory}`);
    process.exit(1);
  }
}

ensureMosaicDir();

updateProvidersWithLatestModels().catch(() => {});

clearTerminal();

if (verboseMode) {
  console.log('[Mosaic] Verbose mode enabled. You will see detailed execution logs.\n');
}

setTerminalTitle('✹ Mosaic');

const { waitUntilExit } = render(<App initialVerboseMode={verboseMode} />, {
  exitOnCtrlC: false,
});

waitUntilExit().catch(() => {
  process.exit(1);
});