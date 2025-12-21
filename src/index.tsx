#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import { resolve, isAbsolute } from 'path';
import { statSync } from 'fs';
import App from './components/App.js';
import { ensureMosaicDir } from './config/index.js';
import { setTerminalTitle, clearTerminal } from './utils/terminalUtils.js';
import { updateProvidersWithLatestModels } from './config/providers.js';

const args = process.argv.slice(2);
if (args.length > 0) {
  const targetPath = args[0];
  const resolvedPath = isAbsolute(targetPath) ? targetPath : resolve(process.cwd(), targetPath);

  try {
    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      console.error(`mosaic: not a directory: ${targetPath}`);
      process.exit(1);
    }

    process.chdir(resolvedPath);
  } catch {
    console.error(`mosaic: directory not found or inaccessible: ${targetPath}`);
    process.exit(1);
  }
}

ensureMosaicDir();

updateProvidersWithLatestModels().catch(() => {});

clearTerminal();

setTerminalTitle('✹ Mosaic');

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: false,
});

waitUntilExit().catch(() => {
  process.exit(1);
});