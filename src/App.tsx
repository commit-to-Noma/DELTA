import React, { useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { AppShell } from './components/shell/AppShell';

export const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'landing' | 'app'>('landing');

  return (
    <div className="min-h-screen bg-onyx-950">
      {currentMode === 'landing' ? (
        <LandingPage onEnterApp={() => setCurrentMode('app')} />
      ) : (
        <AppShell onExitToLanding={() => setCurrentMode('landing')} />
      )}
    </div>
  );
};

export default App;
