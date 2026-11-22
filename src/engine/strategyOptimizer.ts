/**
 * strategyOptimizer.ts
 * Formula 1 Race Strategy Optimizer & Stint Evaluator.
 * Full combinatorial search across 1-stop and 2-stop strategies with lap-by-lap
 * fuel burn mass progression and non-linear Pirelli tyre degradation.
 */

import { CompoundName, CircuitData, StrategyPlanResult, RaceSimulationResult } from './types';
import { COMPOUNDS, gripMultiplier } from './tyreModel';
import { car2025 } from './carModel';
import { simulateLap } from './lapSim';

const DRY_COMPOUNDS: CompoundName[] = ['soft', 'medium', 'hard'];

// Maximum realistic stint length per dry compound before total tyre failure
const MAX_STINT_LAPS: Record<CompoundName, number> = {
  soft: 25,
  medium: 38,
  hard: 55,
  inter: 30,
  wet: 30,
};

export interface StintTuple {
  compound: CompoundName;
  laps: number;
}

export const TRACK_SC_PROBABILITY: Record<string, { scProb: number; vscProb: number }> = {
  "bahrain": { scProb: 0.35, vscProb: 0.40 },
  "jeddah": { scProb: 0.75, vscProb: 0.50 },
  "albert_park": { scProb: 0.65, vscProb: 0.45 },
  "suzuka": { scProb: 0.40, vscProb: 0.45 },
  "shanghai": { scProb: 0.45, vscProb: 0.40 },
  "miami": { scProb: 0.55, vscProb: 0.45 },
  "imola": { scProb: 0.50, vscProb: 0.45 },
  "monaco": { scProb: 0.80, vscProb: 0.50 },
  "montreal": { scProb: 0.65, vscProb: 0.50 },
  "barcelona": { scProb: 0.30, vscProb: 0.35 },
  "red_bull_ring": { scProb: 0.40, vscProb: 0.50 },
  "silverstone": { scProb: 0.45, vscProb: 0.40 },
  "hungaroring": { scProb: 0.35, vscProb: 0.40 },
  "spa": { scProb: 0.55, vscProb: 0.50 },
  "zandvoort": { scProb: 0.55, vscProb: 0.45 },
  "monza": { scProb: 0.30, vscProb: 0.35 },
  "baku": { scProb: 0.75, vscProb: 0.50 },
  "singapore": { scProb: 0.95, vscProb: 0.55 },
  "cota": { scProb: 0.45, vscProb: 0.40 },
  "mexico_city": { scProb: 0.40, vscProb: 0.40 },
  "interlagos": { scProb: 0.65, vscProb: 0.50 },
  "las_vegas": { scProb: 0.60, vscProb: 0.45 },
  "lusail": { scProb: 0.35, vscProb: 0.40 },
  "yas_marina": { scProb: 0.40, vscProb: 0.40 },
};

export interface CircuitSensitivity {
  baseLapTime: number; // Lap time with 105 kg fuel & 1.0 grip
  fuelSensitivitySecPerKg: number; // sec / kg
  gripSensitivitySecPerUnit: number; // sec / unit of grip deficit (1 - mu)
}

const sensitivityCache = new Map<string, CircuitSensitivity>();

/**
 * Calibrates analytical sensitivity derivatives for a circuit using exactly 3 reference solves.
 * Cached per circuit so subsequent recalculations execute in sub-millisecond time.
 */
export function getCircuitSensitivity(circuit: CircuitData): CircuitSensitivity {
  const cached = sensitivityCache.get(circuit.id);
  if (cached) return cached;

  const baseCar = car2025(circuit.name, 'race');
  const simStep = 14.0;

  // 1. Heavy fuel reference (105 kg, grip 1.0)
  const heavy = simulateLap(circuit, baseCar, {
    step: simStep,
    fuelMassKg: 105.0,
    gripMultiplier: 1.0,
    energySolve: false,
  });

  // 2. Light fuel reference (10 kg, grip 1.0)
  const light = simulateLap(circuit, baseCar, {
    step: simStep,
    fuelMassKg: 10.0,
    gripMultiplier: 1.0,
    energySolve: false,
  });

  // 3. Worn tyre reference (105 kg, grip 0.90)
  const worn = simulateLap(circuit, baseCar, {
    step: simStep,
    fuelMassKg: 105.0,
    gripMultiplier: 0.90,
    energySolve: false,
  });

  const fuelSens = Math.max(0.015, Math.min(0.060, (heavy.lapTime - light.lapTime) / 95.0));
  const gripSens = Math.max(2.0, Math.min(120.0, (worn.lapTime - heavy.lapTime) / 0.10));

  const sens: CircuitSensitivity = {
    baseLapTime: heavy.lapTime,
    fuelSensitivitySecPerKg: fuelSens,
    gripSensitivitySecPerUnit: gripSens,
  };

  sensitivityCache.set(circuit.id, sens);
  return sens;
}

/**
 * Generates all valid 1-stop strategy plans covering totalLaps.
 * Enforces the FIA rule: must use at least two distinct dry compounds.
 */
export function generate1StopPlans(totalLaps: number, minStint: number = 8, lapStep: number = 2): StintTuple[][] {
  const effectiveMin = Math.max(2, Math.min(minStint, Math.floor(totalLaps / 3)));
  const plans: StintTuple[][] = [];

  for (const c1 of DRY_COMPOUNDS) {
    for (const c2 of DRY_COMPOUNDS) {
      if (c1 === c2) continue; // Must use 2 different compounds
      const maxLaps1 = Math.min(totalLaps - effectiveMin, MAX_STINT_LAPS[c1]);
      for (let laps1 = effectiveMin; laps1 <= maxLaps1; laps1 += lapStep) {
        const laps2 = totalLaps - laps1;
        if (laps2 >= effectiveMin && laps2 <= MAX_STINT_LAPS[c2]) {
          plans.push([
            { compound: c1, laps: laps1 },
            { compound: c2, laps: laps2 },
          ]);
        }
      }
    }
  }
  return plans;
}

/**
 * Generates valid 2-stop strategy plans covering totalLaps.
 */
export function generate2StopPlans(totalLaps: number, minStint: number = 7, lapStep: number = 4): StintTuple[][] {
  const effectiveMin = Math.max(2, Math.min(minStint, Math.floor(totalLaps / 5)));
  const plans: StintTuple[][] = [];

  for (const c1 of DRY_COMPOUNDS) {
    for (const c2 of DRY_COMPOUNDS) {
      for (const c3 of DRY_COMPOUNDS) {
        // Must contain at least two distinct compounds across the 3 stints
        if (new Set([c1, c2, c3]).size < 2) continue;

        const maxLaps1 = Math.min(totalLaps - 2 * effectiveMin, MAX_STINT_LAPS[c1]);
        for (let laps1 = effectiveMin; laps1 <= maxLaps1; laps1 += lapStep) {
          const maxLaps2 = Math.min(totalLaps - laps1 - effectiveMin, MAX_STINT_LAPS[c2]);
          for (let laps2 = effectiveMin; laps2 <= maxLaps2; laps2 += lapStep) {
            const laps3 = totalLaps - laps1 - laps2;
            if (laps3 >= effectiveMin && laps3 <= MAX_STINT_LAPS[c3]) {
              plans.push([
                { compound: c1, laps: laps1 },
                { compound: c2, laps: laps2 },
                { compound: c3, laps: laps3 },
              ]);
            }
          }
        }
      }
    }
  }
  return plans;
}

/**
 * Simulates a single race strategy lap by lap using the calibrated sensitivity model.
 */
export function simulateRaceStrategy(
  circuit: CircuitData,
  stintPlan: StintTuple[],
  options: {
    pitLossS?: number;
    initialFuelKg?: number;
    step?: number;
    scLap?: number;
    dirtyAirLaps?: number;
  } = {},
): RaceSimulationResult {
  const totalLaps = stintPlan.reduce((acc, s) => acc + s.laps, 0);
  const pitLoss = options.pitLossS ?? circuit.pitLossS ?? 23.0;
  const initialFuel = options.initialFuelKg ?? 105.0;
  const fuelPerLap = initialFuel / Math.max(totalLaps, 1);

  const sens = getCircuitSensitivity(circuit);
  const thermalLoad = circuit.tyreStress ?? 1.0;

  const allLapTimes: number[] = [];
  const fuelMassHistory: number[] = [];
  const stintLapsHistory: number[] = [];
  let totalTime = 0.0;
  let currentFuel = initialFuel;
  let currentRaceLap = 0;

  for (let stintIdx = 0; stintIdx < stintPlan.length; stintIdx++) {
    const stint = stintPlan[stintIdx];
    const compound = COMPOUNDS[stint.compound];

    for (let lapOnTyre = 1; lapOnTyre <= stint.laps; lapOnTyre++) {
      currentRaceLap++;
      const gMult = gripMultiplier(compound, lapOnTyre, thermalLoad);

      // Fast analytical sensitivity formulation calibrated from 3 reference solves
      const deltaFuel = (currentFuel - 105.0) * sens.fuelSensitivitySecPerKg;
      const deltaGrip = (1.0 - gMult) * sens.gripSensitivitySecPerUnit;
      let lapT = sens.baseLapTime + deltaFuel + deltaGrip;

      // Dirty air penalty: if in traffic within dirtyAirLaps
      if (options.dirtyAirLaps && currentRaceLap <= options.dirtyAirLaps) {
        lapT += 1.15; // +1.15s/lap dirty air turbulence penalty
      }

      allLapTimes.push(lapT);
      fuelMassHistory.push(currentFuel);
      stintLapsHistory.push(lapOnTyre);
      totalTime += lapT;

      currentFuel = Math.max(2.0, currentFuel - fuelPerLap);
    }

    // Add pit stop loss after each stint except the last
    if (stintIdx < stintPlan.length - 1) {
      let effectivePitLoss = pitLoss;
      // If Safety Car is deployed near this pit stop, pit loss is discounted by ~45%
      if (options.scLap && Math.abs(currentRaceLap - options.scLap) <= 2) {
        effectivePitLoss *= 0.55;
      }
      totalTime += effectivePitLoss;
    }
  }

  return {
    totalTime,
    lapTimes: allLapTimes,
    fuelMass: fuelMassHistory,
    stintLaps: stintLapsHistory,
    stints: stintPlan,
  };
}

/**
 * Evaluates candidate strategies and returns the optimal rankings.
 */
export function optimizeStrategy(
  circuit: CircuitData,
  totalLaps: number,
  include2Stop: boolean = true,
  maxCandidates: number = 40,
  options: {
    pitLossS?: number;
    scLap?: number;
    dirtyAirLaps?: number;
  } = {},
): StrategyPlanResult[] {
  const plans1 = generate1StopPlans(totalLaps, 8, 3);
  const plans2 = include2Stop ? generate2StopPlans(totalLaps, 7, 5) : [];
  const candidatePlans = [...plans1, ...plans2];

  const results: {
    totalTime: number;
    plan: StintTuple[];
    stopCount: number;
    pitStopLaps: number[];
  }[] = [];

  for (const plan of candidatePlans) {
    const res = simulateRaceStrategy(circuit, plan, {
      pitLossS: options.pitLossS,
      scLap: options.scLap,
      dirtyAirLaps: options.dirtyAirLaps,
    });

    const pitStopLaps: number[] = [];
    let cumLap = 0;
    for (let i = 0; i < plan.length - 1; i++) {
      cumLap += plan[i].laps;
      pitStopLaps.push(cumLap);
    }

    results.push({
      totalTime: res.totalTime,
      plan,
      stopCount: plan.length - 1,
      pitStopLaps,
    });
  }

  results.sort((a, b) => a.totalTime - b.totalTime);
  const bestTime = results[0]?.totalTime ?? 0;
  const basePitLoss = options.pitLossS ?? circuit.pitLossS ?? 23.0;

  return results.slice(0, maxCandidates).map((r) => {
    // Calculate potential SC time savings if a safety car occurred during the pit window
    const scSavings = (basePitLoss * 0.45) * r.stopCount;
    return {
      totalTime: r.totalTime,
      deltaVsBest: r.totalTime - bestTime,
      plan: r.plan.map((s) => [s.compound, s.laps] as [CompoundName, number]),
      stopCount: r.stopCount,
      pitStopLaps: r.pitStopLaps,
      scTimeSavings: scSavings,
    };
  });
}
