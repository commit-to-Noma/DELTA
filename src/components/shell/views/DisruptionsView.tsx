/**
 * DELTA DisruptionsView
 *
 * Spatial disruption replanning is integrated directly into Stage 02 (FloodSimulationView)
 * so baseline simulation, interactive map inspection, and disruption recalculation share
 * one synchronized workspace state.
 */

import React from 'react';
import { FloodSimulationView } from './FloodSimulationView';

export const DisruptionsView: React.FC = () => {
  return <FloodSimulationView />;
};
