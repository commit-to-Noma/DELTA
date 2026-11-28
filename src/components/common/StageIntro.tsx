import React from 'react';

export const StageIntro: React.FC<{ subtitle: string }> = ({ subtitle }) => (
  <p className="text-xs text-storm-300 leading-snug">
    <span className="font-mono font-bold text-storm-100 uppercase tracking-wide">What to do here: </span>
    {subtitle}
  </p>
);
