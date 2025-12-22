import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import FirstWelcome from './FirstWelcome.js';
import ConfigSetup from './ConfigSetup.js';
import ChatInterface from './ChatInterface.js';
import { loadConfig, getMissingConfigs } from '../config/index.js';
import { getPackageVersion } from '../config/index.js';

const version = getPackageVersion();

interface AppProps {
  initialVerboseMode?: boolean;
}

const App: React.FC<AppProps> = ({ initialVerboseMode = false }) => {
  const [currentView, setCurrentView] = useState<'welcome' | 'config' | 'main'>('welcome');
  const [missingConfigs, setMissingConfigs] = useState<string[]>([]);

  useEffect(() => {
    const config = loadConfig();
    const missing = getMissingConfigs(config);
    setMissingConfigs(missing);

    if (missing.length === 0) {
      setCurrentView('main');
    }
  }, []);

  const handleWelcomeComplete = () => {
    setCurrentView('config');
  };

  const handleConfigComplete = () => {
    setCurrentView('main');
  };

  if (currentView === 'main') {
    return <ChatInterface initialVerboseMode={initialVerboseMode} />;
  }

  if (currentView === 'welcome') {
    return <FirstWelcome onComplete={handleWelcomeComplete} />;
  }

  if (currentView === 'config') {
    return (
      <>
        <FirstWelcome
          onComplete={() => { }}
          showPrompt={false}
          enableInput={false}
        />
        <ConfigSetup
          missingConfigs={missingConfigs}
          onComplete={handleConfigComplete}
        />
      </>
    );
  }

  return null;
};

export default App;