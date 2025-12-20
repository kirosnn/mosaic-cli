#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import App from './components/App.js';
import { ensureMosaicDir } from './config/index.js';
import { setTerminalTitle } from './utils/terminalTitle.js';

ensureMosaicDir();

setTerminalTitle('✹ Mosaic');

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: false,
});

waitUntilExit().catch(() => {
  process.exit(1);
});