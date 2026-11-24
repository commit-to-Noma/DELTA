import React from 'react';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { ProblemSolutionSection } from './ProblemSolutionSection';
import { InteractiveFeatureWorkbench } from './InteractiveFeatureWorkbench';
import { WorkflowSection } from './WorkflowSection';
import { TechStackSection } from './TechStackSection';
import { MissionVisionFooter } from './MissionVisionFooter';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  return (
    <div className="min-h-screen bg-onyx-950 text-storm-100 flex flex-col selection:bg-safety-orange selection:text-white">
      <LandingHeader onEnterApp={onEnterApp} />
      <main className="flex-1">
        <HeroSection onEnterApp={onEnterApp} />
        <ProblemSolutionSection />
        <InteractiveFeatureWorkbench />
        <WorkflowSection />
        <TechStackSection />
      </main>
      <MissionVisionFooter onEnterApp={onEnterApp} />
    </div>
  );
};
