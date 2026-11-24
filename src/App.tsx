import React, { useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { AppShell } from './components/shell/AppShell';

export const App: React.FC = () => {
  // Check URL parameter: default to operational application shell for Forge integration,
  // allow ?view=landing for inspecting the landing page
  const initialMode = typeof window !== 'undefined' && window.location.search.includes('view=landing')
    ? 'landing'
    : 'app';

  const [currentMode, setCurrentMode] = useState<'landing' | 'app'>(initialMode);

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
