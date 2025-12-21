#!/usr/bin/env node
import { render } from 'ink';
import React from 'react';
import App from './components/App.js';
import { ensureMosaicDir } from './config/index.js';
import { setTerminalTitle } from './utils/terminalTitle.js';
import { updateProvidersWithLatestModels } from './config/providers.js';

ensureMosaicDir();

updateProvidersWithLatestModels().catch(() => {});

setTerminalTitle('✹ Mosaic');

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: false,
});

waitUntilExit().catch(() => {
  process.exit(1);
});