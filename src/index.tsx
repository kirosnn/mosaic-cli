#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import App from './components/App.js';
import { ensureMosaicDir } from './config/index.js';

function setTerminalTitle(title: string): void {
  process.stdout.write(`\x1b]0;${title}\x07`);
}

ensureMosaicDir();

setTerminalTitle('✹ Mosaic');

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: false,
});

waitUntilExit().catch(() => {
  process.exit(1);
});