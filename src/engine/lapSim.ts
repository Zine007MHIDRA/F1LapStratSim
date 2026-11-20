/**
 * lapSim.ts
 * Quasi-Static Point-Mass Forward-Backward Speed Profile Solver with ERS Energy Tracking.
 * Complete client-side implementation of validated lap_sim.py.
 */

import { CarParams, CircuitData, LapSimulationResult, Segment } from './types';
import {
  G,
  maxCornerSpeed,
  maxTractionAccel,
  maxBrakeDecel,
  dragForce,
} from './carModel';

const DRS_MIN_STRAIGHT_M = 150.0;
const DRS_SPEED_THRESHOLD_KMH = 200.0;
const MAX_LATERAL_G = 6.0;
const N_SWEEPS = 3;
const ERS_ITERS = 3;

export interface DiscretizedTrack {
  s: number[];
  radius: number[];
  segIdx: number[];
  dsArr: number[];
  lapLengthM: number;
}

/**
 * Discretizes circuit segments into equidistant spatial points along the lap.
 */
export function buildDistanceAxis(segments: Segment[], step: number = 3.0): DiscretizedTrack {
  const s: number[] = [];
  const radius: number[] = [];
  const segIdx: number[] = [];

  let cumDist = 0.0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nPoints = Math.max(1, Math.round(seg.length / step));
    const delta = seg.length / nPoints;

    for (let k = 0; k < nPoints; k++) {
      s.push(cumDist);
      radius.push(seg.kind === 'corner' ? seg.radius : Infinity);
      segIdx.push(i);
      cumDist += delta;
    }
  }

  const n = s.length;
  const dsArr = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const nextDist = i === n - 1 ? cumDist : s[i + 1];
    dsArr[i] = Math.max(0.1, nextDist - s[i]);
  }

  return { s, radius, segIdx, dsArr, lapLengthM: cumDist };
}

function drsEligibility(
  segments: Segment[],
  segIdx: number[],
  car: CarParams,
): boolean[] {
  if (!car.drsAvailable) {
    return new Array(segIdx.length).fill(false);
  }
  const explicit = segments.some((s) => s.kind === 'straight' && s.drs);
  return segIdx.map((idx) => {
    const seg = segments[idx];
    if (seg.kind !== 'straight') return false;
    return explicit ? !!seg.drs : seg.length >= DRS_MIN_STRAIGHT_M;
  });
}

function lateralG(v: number, r: number): number {
  if (!isFinite(r) || r <= 0) return 0.0;
  return Math.min((v * v) / (r * G), MAX_LATERAL_G);
}

function edgeDt(vProfile: number[], dsArr: number[]): number[] {
  const n = vProfile.length;
  const dt = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const nextV = vProfile[(i + 1) % n];
    dt[i] = (2.0 * dsArr[i]) / Math.max(vProfile[i] + nextV, 1e-4);
  }
  return dt;
}

function edgeAccel(vProfile: number[], dsArr: number[]): number[] {
  const n = vProfile.length;
  const a = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const nextV = vProfile[(i + 1) % n];
    a[i] = (nextV * nextV - vProfile[i] * vProfile[i]) / (2.0 * Math.max(dsArr[i], 1e-4));
  }
  return a;
}

function integrateErs(
  vProfile: number[],
  dsArr: number[],
  dtArr: number[],
  car: CarParams,
) {
  const n = vProfile.length;
  const aEdge = edgeAccel(vProfile, dsArr);

  const ersPower = new Array<number>(n).fill(0);
  const socTrace = new Array<number>(n).fill(0);
  const clipFlags = new Array<boolean>(n).fill(false);

  const cap = car.batteryCapacityJ;
  let battery = cap;
  const budget = car.mgukDeployBudgetJ;
  let deployedJ = 0.0;
  let harvestedJ = 0.0;
  const regenW = car.era === '2026' ? 350_000.0 * car.regenEfficiency : 120_000.0 * car.regenEfficiency;

  for (let i = 0; i < n; i++) {
    const dt = dtArr[i];
    const a = aEdge[i];

    if (a > 0.15) {
      // Accelerating -> deploy MGU-K
      const wantJ = car.mgukPowerW * dt;
      let availJ = wantJ;
      if (budget !== null) {
        availJ = Math.min(availJ, Math.max(budget - deployedJ, 0.0));
      }
      if (car.era === '2026') {
        availJ = Math.min(availJ, Math.max(battery, 0.0));
      }
      const frac = wantJ > 1e-9 ? availJ / wantJ : 0.0;
      ersPower[i] = car.mgukPowerW * frac;
      deployedJ += availJ;
      battery -= availJ;

      const nearEmpty = car.era === '2026' && battery < 0.05 * cap;
      if (vProfile[i] * 3.6 > 150.0 && (frac < 0.9 || nearEmpty)) {
        clipFlags[i] = true;
      }
    } else if (a < -0.15) {
      // Braking -> harvest regen
      let harvJ = regenW * dt;
      if (car.era === '2026') {
        harvJ = Math.min(harvJ, Math.max(cap - battery, 0.0));
        battery += harvJ;
      }
      harvestedJ += harvJ;
    } else {
      // Cruise / lift-and-coast
      if (car.era === '2026') {
        const harvJ = Math.min(0.35 * regenW * dt, Math.max(cap - battery, 0.0));
        battery += harvJ;
        harvestedJ += harvJ;
      }
    }

    if (car.era === '2025') {
      battery = cap; // MGU-H keeps battery replenished continuously
    }
    socTrace[i] = battery;
  }

  let clipDistanceM = 0;
  for (let i = 0; i < n; i++) {
    if (clipFlags[i]) clipDistanceM += dsArr[i];
  }

  let minSocJ = cap;
  for (let i = 0; i < n; i++) {
    if (socTrace[i] < minSocJ) minSocJ = socTrace[i];
  }

  return {
    ersPower,
    diagnostics: {
      deployedJ,
      harvestedJ,
      socTrace,
      minSocJ,
      socStartJ: cap,
      clipDistanceM,
      energySolved: true,
    },
  };
}

function forwardPass(
  vCeiling: number[],
  dsArr: number[],
  radius: number[],
  drsEligible: boolean[],
  car: CarParams,
  ersPower: number[],
): number[] {
  const n = vCeiling.length;
  const v = [...vCeiling];

  let seed = 0;
  for (let i = 1; i < n; i++) {
    if (v[i] < v[seed]) seed = i;
  }

  for (let offset = 1; offset <= n; offset++) {
    const i = (seed + offset) % n;
    const prev = (i - 1 + n) % n;
    const ds = dsArr[prev];
    const vPrev = v[prev];
    const latGDemand = lateralG(vPrev, radius[prev]);
    const isDrs = drsEligible[prev] && vPrev * 3.6 > DRS_SPEED_THRESHOLD_KMH;
    const a = maxTractionAccel(vPrev, car, latGDemand, isDrs, ersPower[prev]);
    const vPossible = Math.sqrt(Math.max(vPrev * vPrev + 2.0 * a * ds, 0.0));
    v[i] = Math.min(vPossible, vCeiling[i]);
  }
  return v;
}

function backwardPass(
  vCeiling: number[],
  dsArr: number[],
  radius: number[],
  car: CarParams,
): number[] {
  const n = vCeiling.length;
  const v = [...vCeiling];

  let seed = 0;
  for (let i = 1; i < n; i++) {
    if (v[i] < v[seed]) seed = i;
  }

  for (let offset = 1; offset <= n; offset++) {
    const i = (seed - offset + n) % n;
    const next = (i + 1) % n;
    const ds = dsArr[i];
    const vNext = v[next];
    const latGDemand = lateralG(vNext, radius[i]);
    const aBrake = maxBrakeDecel(vNext, car, latGDemand);
    const vPossible = Math.sqrt(Math.max(vNext * vNext + 2.0 * aBrake * ds, 0.0));
    v[i] = Math.min(vPossible, vCeiling[i]);
  }
  return v;
}

function converge(
  vCap: number[],
  dsArr: number[],
  radius: number[],
  drsEligible: boolean[],
  car: CarParams,
  ersPower: number[],
  sweeps: number = N_SWEEPS,
): number[] {
  let v = [...vCap];
  for (let s = 0; s < sweeps; s++) {
    const vFwd = forwardPass(v, dsArr, radius, drsEligible, car, ersPower);
    for (let i = 0; i < v.length; i++) v[i] = Math.min(v[i], vFwd[i]);

    const vBwd = backwardPass(v, dsArr, radius, car);
    for (let i = 0; i < v.length; i++) v[i] = Math.min(v[i], vBwd[i]);
  }
  return v;
}

function derivePedals(
  vProfile: number[],
  dsArr: number[],
  radius: number[],
  drsEligible: boolean[],
  car: CarParams,
  ersPower: number[],
) {
  const n = vProfile.length;
  const throttlePct = new Array<number>(n).fill(0);
  const brakePct = new Array<number>(n).fill(0);
  const gear = new Array<number>(n).fill(1);

  for (let i = 1; i < n; i++) {
    const ds = dsArr[i - 1];
    const vPrev = vProfile[i - 1];
    const vCur = vProfile[i];
    const aActual = (vCur * vCur - vPrev * vPrev) / (2.0 * Math.max(ds, 1e-4));
    const latGDemand = lateralG(vPrev, radius[i]);
    const isDrs = drsEligible[i] && vPrev * 3.6 > DRS_SPEED_THRESHOLD_KMH;

    if (aActual > 0.05) {
      const aMax = maxTractionAccel(vPrev, car, latGDemand, isDrs, ersPower[i]);
      throttlePct[i] = Math.min(100, Math.max(0, (aActual / Math.max(aMax, 1e-3)) * 100));
    } else if (aActual < -0.05) {
      const aBrake = maxBrakeDecel(vPrev, car, latGDemand);
      brakePct[i] = Math.min(100, Math.max(0, (Math.abs(aActual) / Math.max(aBrake, 1e-3)) * 100));
    } else {
      const fDrag = dragForce(vPrev, car, isDrs);
      const totalPower = car.icePowerW + ersPower[i];
      const engineForceMax = totalPower / Math.max(vPrev, 5.0);
      throttlePct[i] = Math.min(100, Math.max(0, (fDrag / Math.max(engineForceMax, 1e-3)) * 100));
    }

    // Realistic F1 8-speed gearbox logic based on speed (km/h)
    const spdKmh = vCur * 3.6;
    if (spdKmh < 105) gear[i] = 1;
    else if (spdKmh < 138) gear[i] = 2;
    else if (spdKmh < 178) gear[i] = 3;
    else if (spdKmh < 218) gear[i] = 4;
    else if (spdKmh < 258) gear[i] = 5;
    else if (spdKmh < 292) gear[i] = 6;
    else if (spdKmh < 326) gear[i] = 7;
    else gear[i] = 8;
  }

  if (n > 1) {
    throttlePct[0] = throttlePct[1];
    brakePct[0] = brakePct[1];
    gear[0] = gear[1];
  }

  return { throttlePct, brakePct, gear };
}

/**
 * Main simulation function for a single flying lap.
 */
export function simulateLap(
  circuit: CircuitData,
  car: CarParams,
  options: {
    step?: number;
    gripMultiplier?: number;
    energySolve?: boolean;
    fuelMassKg?: number;
  } = {},
): LapSimulationResult {
  const step = options.step ?? 3.0;
  const gripMult = options.gripMultiplier ?? 1.0;
  const doEnergySolve = options.energySolve ?? true;
  const fuel = options.fuelMassKg ?? car.fuelMass;

  // Clone car with adjusted fuel and tyre grip
  const effCar: CarParams = {
    ...car,
    fuelMass: fuel,
    totalMass: car.massEmpty + fuel,
    tyreMu: car.tyreMu * gripMult,
  };

  const { s, radius, segIdx, dsArr, lapLengthM } = buildDistanceAxis(circuit.segments, step);
  const n = s.length;

  // 1. Calculate corner and mechanical top-speed ceilings
  const vCap = new Array<number>(n);
  const maxV = effCar.topSpeedKmh / 3.6;
  for (let i = 0; i < n; i++) {
    vCap[i] = Math.min(maxV, maxCornerSpeed(radius[i], effCar));
  }

  const drsEligible = drsEligibility(circuit.segments, segIdx, effCar);

  // 2. Unconstrained speed profile (full MGU-K)
  let ersPower = new Array<number>(n).fill(effCar.mgukPowerW);
  let v = converge(vCap, dsArr, radius, drsEligible, effCar, ersPower, N_SWEEPS);
  const vFree = [...v];

  // 3. ERS integration and convergence loop
  let ersDiagnostics = {
    deployedJ: 0,
    harvestedJ: 0,
    socTrace: new Array<number>(n).fill(effCar.batteryCapacityJ),
    minSocJ: effCar.batteryCapacityJ,
    socStartJ: effCar.batteryCapacityJ,
    clipDistanceM: 0,
    energySolved: false,
  };

  if (doEnergySolve) {
    for (let iter = 0; iter < ERS_ITERS; iter++) {
      const dtTmp = edgeDt(v, dsArr);
      const res = integrateErs(v, dsArr, dtTmp, effCar);
      ersPower = res.ersPower;
      ersDiagnostics = res.diagnostics;
      v = converge(vCap, dsArr, radius, drsEligible, effCar, ersPower, 2);
    }
  }

  // 4. Calculate total lap and sector times
  const dtArr = edgeDt(v, dsArr);
  let lapTime = 0.0;
  for (let i = 0; i < n; i++) lapTime += dtArr[i];

  const [f1, f2] = circuit.sectorFractions || [0.33, 0.66];
  const b1 = f1 * lapLengthM;
  const b2 = f2 * lapLengthM;

  let cumD = 0.0;
  let cumT = 0.0;
  let t1 = 0.0;
  let t2 = 0.0;
  let found1 = false;
  let found2 = false;

  for (let i = 0; i < n; i++) {
    cumD += dsArr[i];
    cumT += dtArr[i];
    if (!found1 && cumD >= b1) {
      t1 = cumT;
      found1 = true;
    }
    if (!found2 && cumD >= b2) {
      t2 = cumT;
      found2 = true;
    }
  }
  const sectorTimes: [number, number, number] = [
    t1,
    Math.max(0, t2 - t1),
    Math.max(0, lapTime - t2),
  ];

  // 5. Calculate G-force channels
  const gLat = new Array<number>(n);
  const aEdge = edgeAccel(v, dsArr);
  const gLong = new Array<number>(n);
  const gTotal = new Array<number>(n);
  const speedKmh = new Array<number>(n);
  const speedFreeKmh = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    gLat[i] = lateralG(v[i], radius[i]);
    gLong[i] = aEdge[i] / G;
    gTotal[i] = Math.hypot(gLat[i], gLong[i]);
    speedKmh[i] = v[i] * 3.6;
    speedFreeKmh[i] = vFree[i] * 3.6;
  }

  // 6. Straight speed traps
  const straightSpeeds: Record<string, number> = {};
  for (let i = 0; i < circuit.segments.length; i++) {
    const seg = circuit.segments[i];
    if (seg.kind === 'straight') {
      let maxSpd = 0;
      for (let k = 0; k < n; k++) {
        if (segIdx[k] === i && speedKmh[k] > maxSpd) {
          maxSpd = speedKmh[k];
        }
      }
      straightSpeeds[seg.name] = maxSpd;
    }
  }

  let speedTrapKmh = 0;
  for (let i = 0; i < n; i++) {
    if (speedKmh[i] > speedTrapKmh) speedTrapKmh = speedKmh[i];
  }

  // 7. Pedal derivation
  const { throttlePct, brakePct, gear } = derivePedals(
    v,
    dsArr,
    radius,
    drsEligible,
    effCar,
    ersPower,
  );

  return {
    lapTime,
    distance: s,
    speedKmh,
    speedFreeKmh,
    throttlePct,
    brakePct,
    gear,
    gLat,
    gLong,
    gTotal,
    sectorTimes,
    sectorBoundsM: [b1, b2],
    speedTrapKmh,
    straightSpeeds,
    ers: {
      ...ersDiagnostics,
      ersPowerTrace: ersPower,
    },
    valid: true,
    warnings: [],
  };
}
