import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { AppShell } from './components/shell/AppShell';
import { IssuePanel } from './components/jira/IssuePanel';
import { getContextSafe } from './services/forgeBridge';

export const App: React.FC = () => {
  // Check URL parameter: default to operational application shell for Forge integration,
  // allow ?view=landing for inspecting the landing page, and ?view=panel for Jira issue panel
  const initialMode = typeof window !== 'undefined'
    ? window.location.search.includes('view=landing')
      ? 'landing'
      : window.location.search.includes('view=panel')
      ? 'panel'
      : 'app'
    : 'app';

  const [currentMode, setCurrentMode] = useState<'landing' | 'app' | 'panel'>(initialMode);
  const [activeIssueKey, setActiveIssueKey] = useState<string>('');

  useEffect(() => {
    async function checkForgeContext() {
      try {
        const ctx = await getContextSafe();
        if (ctx?.extension?.type === 'jira:issuePanel') {
          setCurrentMode('panel');
          if (ctx.extension.issue?.key) {
            setActiveIssueKey(ctx.extension.issue.key);
          }
        }
      } catch (e) {
        console.warn('[DELTA] Context check notice:', e);
      }
    }
    checkForgeContext();
  }, []);

  return (
    <div className="min-h-screen bg-onyx-950">
      {currentMode === 'panel' ? (
        <div className="p-4 max-w-4xl mx-auto">
          <IssuePanel initialIssueKey={activeIssueKey} onOpenFullApp={() => setCurrentMode('app')} />
        </div>
      ) : currentMode === 'landing' ? (
        <LandingPage onEnterApp={() => setCurrentMode('app')} />
      ) : (
        <AppShell onExitToLanding={() => setCurrentMode('landing')} />
      )}
    </div>
  );
};

export default App;
