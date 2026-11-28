import { loadBostonCatchment, createHydraulicConfigFromCatchment } from '../../src/data/catchmentLoader';
export function createHydraulicConfigFromCatchmentTestHelper() {
  return createHydraulicConfigFromCatchment(loadBostonCatchment(), { manningN: 0.025, defaultInfiltrationMmPerHour: 2.0, openBoundaries: 'muddy_river_outlet' });
}
