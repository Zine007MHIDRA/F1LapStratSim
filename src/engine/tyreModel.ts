/**
 * tyreModel.ts
 * Pirelli Tyre Degradation Model with non-linear thermal cliff and warm-up dynamics.
 * Direct TypeScript port of validated tyre_model.py.
 */

import { CompoundName } from './types';

export interface TyreCompound {
  name: CompoundName;
  baseGrip: number;          // relative to baseline (1.0 = medium reference)
  degRatePerLap: number;     // linear grip loss per lap
  cliffLap: number;          // lap number where degradation accelerates
  cliffSeverity: number;     // extra grip loss per lap after cliffLap
  optimalStintLaps: number;  // usable stint length
  warmupLaps: number;        // laps to reach peak grip
  warmupPenalty: number;     // grip deficit on initial flying lap
  thermalSensitivity: number;// sensitivity to high-energy circuits
  subCompounds: string;      // Pirelli C-grade mapping
  color: string;             // Official F1 UI color
}

export const COMPOUNDS: Record<CompoundName, TyreCompound> = {
  soft: {
    name: 'soft',
    baseGrip: 1.010,
    degRatePerLap: 0.0020,
    cliffLap: 15,
    cliffSeverity: 0.0080,
    optimalStintLaps: 16,
    warmupLaps: 1.0,
    warmupPenalty: 0.012,
    thermalSensitivity: 1.35,
    subCompounds: 'C3 / C4 / C5',
    color: '#FF1801', // Pirelli Red
  },
  medium: {
    name: 'medium',
    baseGrip: 1.000,
    degRatePerLap: 0.0010,
    cliffLap: 26,
    cliffSeverity: 0.0045,
    optimalStintLaps: 27,
    warmupLaps: 2.0,
    warmupPenalty: 0.018,
    thermalSensitivity: 1.10,
    subCompounds: 'C2 / C3',
    color: '#FFD700', // Pirelli Yellow
  },
  hard: {
    name: 'hard',
    baseGrip: 0.990,
    degRatePerLap: 0.0005,
    cliffLap: 38,
    cliffSeverity: 0.0028,
    optimalStintLaps: 40,
    warmupLaps: 3.0,
    warmupPenalty: 0.028,
    thermalSensitivity: 0.85,
    subCompounds: 'C1 / C2',
    color: '#FFFFFF', // Pirelli White
  },
  inter: {
    name: 'inter',
    baseGrip: 0.930,
    degRatePerLap: 0.0060,
    cliffLap: 18,
    cliffSeverity: 0.0090,
    optimalStintLaps: 20,
    warmupLaps: 1.0,
    warmupPenalty: 0.015,
    thermalSensitivity: 1.5,
    subCompounds: 'Cinturato Green',
    color: '#39B54A', // Pirelli Green
  },
  wet: {
    name: 'wet',
    baseGrip: 0.870,
    degRatePerLap: 0.0035,
    cliffLap: 28,
    cliffSeverity: 0.0060,
    optimalStintLaps: 30,
    warmupLaps: 1.0,
    warmupPenalty: 0.010,
    thermalSensitivity: 1.6,
    subCompounds: 'Cinturato Blue',
    color: '#00AEEF', // Pirelli Blue
  },
};

export const MIN_GRIP_FLOOR = 0.75;

/**
 * Computes grip multiplier for a given tyre compound and stint age.
 * 
 * @param compound Tyre compound definition
 * @param lapsOnTyre Lap number in stint (1-indexed)
 * @param thermalLoad Circuit tyre stress factor (1.0 = neutral; >1 = abrasive / high lateral)
 * @returns Grip multiplier to scale tyreMu (e.g. 0.985)
 */
export function gripMultiplier(
  compound: TyreCompound,
  lapsOnTyre: number,
  thermalLoad: number = 1.0,
): number {
  let thermal = 1.0 + (thermalLoad - 1.0) * compound.thermalSensitivity;
  thermal = Math.max(thermal, 0.5);

  const warmupLoss =
    compound.warmupPenalty *
    Math.max(0.0, 1.0 - (lapsOnTyre - 1) / Math.max(compound.warmupLaps, 1e-6));

  const linearLoss = compound.degRatePerLap * lapsOnTyre * thermal;

  let cliffLoss = 0.0;
  if (lapsOnTyre > compound.cliffLap) {
    cliffLoss = compound.cliffSeverity * (lapsOnTyre - compound.cliffLap) * thermal;
  }

  const grip = compound.baseGrip - warmupLoss - linearLoss - cliffLoss;
  return Math.max(grip, MIN_GRIP_FLOOR);
}
