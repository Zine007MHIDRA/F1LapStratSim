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

export interface StintTuple {
  compound: CompoundName;
  laps: number;
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
      for (let laps1 = effectiveMin; laps1 <= totalLaps - effectiveMin; laps1 += lapStep) {
        const laps2 = totalLaps - laps1;
        if (laps2 >= effectiveMin) {
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

        for (let laps1 = effectiveMin; laps1 <= totalLaps - 2 * effectiveMin; laps1 += lapStep) {
          for (let laps2 = effectiveMin; laps2 <= totalLaps - laps1 - effectiveMin; laps2 += lapStep) {
            const laps3 = totalLaps - laps1 - laps2;
            if (laps3 >= effectiveMin) {
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
 * Simulates a single race strategy lap by lap.
 */
export function simulateRaceStrategy(
  circuit: CircuitData,
  stintPlan: StintTuple[],
  options: {
    pitLossS?: number;
    initialFuelKg?: number;
    step?: number;
  } = {},
): RaceSimulationResult {
  const totalLaps = stintPlan.reduce((acc, s) => acc + s.laps, 0);
  const pitLoss = options.pitLossS ?? circuit.pitLossS ?? 23.0;
  const initialFuel = options.initialFuelKg ?? 105.0;
  const fuelPerLap = initialFuel / Math.max(totalLaps, 1);
  const simStep = options.step ?? 12.0;

  const baseCar = car2025(circuit.name, 'race');
  const thermalLoad = circuit.tyreStress ?? 1.0;

  const allLapTimes: number[] = [];
  const fuelMassHistory: number[] = [];
  const stintLapsHistory: number[] = [];
  let totalTime = 0.0;
  let currentFuel = initialFuel;

  for (let stintIdx = 0; stintIdx < stintPlan.length; stintIdx++) {
    const stint = stintPlan[stintIdx];
    const compound = COMPOUNDS[stint.compound];

    for (let lapOnTyre = 1; lapOnTyre <= stint.laps; lapOnTyre++) {
      const gMult = gripMultiplier(compound, lapOnTyre, thermalLoad);
      const lapRes = simulateLap(circuit, baseCar, {
        step: simStep,
        gripMultiplier: gMult,
        fuelMassKg: currentFuel,
        energySolve: false, // In races, continuous balanced deployment is used
      });

      allLapTimes.push(lapRes.lapTime);
      fuelMassHistory.push(currentFuel);
      stintLapsHistory.push(lapOnTyre);
      totalTime += lapRes.lapTime;

      currentFuel = Math.max(2.0, currentFuel - fuelPerLap);
    }

    // Add pit stop loss after each stint except the last
    if (stintIdx < stintPlan.length - 1) {
      totalTime += pitLoss;
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
): StrategyPlanResult[] {
  const plans1 = generate1StopPlans(totalLaps, 8, 3);
  const plans2 = include2Stop ? generate2StopPlans(totalLaps, 7, 5) : [];
  const candidatePlans = [...plans1, ...plans2];

  const results: { totalTime: number; plan: StintTuple[]; stopCount: number }[] = [];

  for (const plan of candidatePlans) {
    const res = simulateRaceStrategy(circuit, plan, { step: 18.0 });
    results.push({
      totalTime: res.totalTime,
      plan,
      stopCount: plan.length - 1,
    });
  }

  results.sort((a, b) => a.totalTime - b.totalTime);
  const bestTime = results[0]?.totalTime ?? 0;

  return results.slice(0, maxCandidates).map((r) => ({
    totalTime: r.totalTime,
    deltaVsBest: r.totalTime - bestTime,
    plan: r.plan.map((s) => [s.compound, s.laps] as [CompoundName, number]),
    stopCount: r.stopCount,
  }));
}
