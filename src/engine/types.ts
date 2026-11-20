/**
 * types.ts
 * Type definitions for F1 Vehicle Dynamics & Strategy Simulation Engine.
 */

export type CompoundName = 'soft' | 'medium' | 'hard' | 'inter' | 'wet';

export interface Segment {
  kind: 'straight' | 'corner';
  length: number; // meters
  name: string;
  radius: number; // meters (0 on straights)
  direction: number; // +1 right, -1 left, 0 straight
  drs: boolean;
}

export interface CircuitTelemetry {
  distance: number[];
  speed: number[];
  throttle: number[];
  brake: number[];
  gear: number[];
  drs: number[];
  x: number[];
  y: number[];
  z: number[];
}

export interface CircuitData {
  id: string;
  name: string;
  fullName: string;
  country: string;
  location: string;
  flag: string;
  characteristics: string;
  direction: string;
  lapRecord: string;
  lapLengthM: number;
  raceLaps: number;
  pitLossS: number;
  tyreStress: number;
  altitudeM: number;
  trackTempC: number;
  airTempC: number;
  poleDriver: string;
  poleLapTime: number;
  topSpeedKmh: number;
  sectorFractions: [number, number];
  drsZoneCount: number;
  segments: Segment[];
  telemetry: CircuitTelemetry;
}

export interface CircuitSummary {
  id: string;
  name: string;
  fullName: string;
  country: string;
  location: string;
  flag: string;
  characteristics: string;
  direction: string;
  lapLengthM: number;
  raceLaps: number;
  pitLossS: number;
  tyreStress: number;
  altitudeM: number;
  poleDriver: string;
  poleLapTime: number;
  topSpeedKmh: number;
  drsZoneCount: number;
}

export interface CarParams {
  name: string;
  era: '2025' | '2026';
  trim: 'qualifying' | 'race';
  massEmpty: number; // kg
  fuelMass: number; // kg
  totalMass: number; // kg
  rho: number; // kg/m^3
  topSpeedKmh: number; // km/h
  // Aero
  CdA: number; // m^2 (fixed or corner)
  ClA: number; // m^2 (fixed or corner)
  straightCdA?: number; // m^2 (2026 active aero X-mode)
  cornerClA?: number; // m^2 (2026 active aero Z-mode)
  drsCdReduction: number;
  drsAvailable: boolean;
  // Powertrain & ERS
  icePowerW: number;
  mgukPowerW: number;
  batteryCapacityJ: number;
  mgukDeployBudgetJ: number | null; // 4.0 MJ cap in 2025, null in 2026
  regenEfficiency: number;
  // Tyre & Brakes
  tyreMu: number;
  frictionEllipseP: number;
  maxDecelG: number;
  // Dynamic Load Transfer Geometry
  wheelbaseM?: number; // meters (e.g. 3.60m)
  cgHeightM?: number; // center of gravity height (e.g. 0.31m)
  frontWeightFraction?: number; // static weight split (e.g. 0.455)
  brakeBias?: number; // front braking force distribution (e.g. 0.56)
}

export interface ErsState {
  deployedJ: number;
  harvestedJ: number;
  socTrace: number[]; // Joules at each point
  ersPowerTrace: number[]; // Watts at each point
  clipDistanceM: number;
  minSocJ: number;
  socStartJ: number;
  energySolved: boolean;
}

export interface LapSimulationResult {
  lapTime: number;
  distance: number[];
  speedKmh: number[];
  speedFreeKmh: number[];
  throttlePct: number[];
  brakePct: number[];
  gear: number[];
  gLat: number[];
  gLong: number[];
  gTotal: number[];
  sectorTimes: [number, number, number];
  sectorBoundsM: [number, number];
  speedTrapKmh: number;
  straightSpeeds: Record<string, number>;
  ers: ErsState;
  elevationM?: number[];
  gradePct?: number[];
  frontNormalLoadN?: number[];
  rearNormalLoadN?: number[];
  valid: boolean;
  warnings: string[];
}

export interface StintInput {
  compound: CompoundName;
  laps: number;
}

export interface RaceSimulationResult {
  totalTime: number;
  lapTimes: number[];
  fuelMass: number[];
  stintLaps: number[];
  stints: StintInput[];
}

export interface StrategyPlanResult {
  totalTime: number;
  deltaVsBest: number;
  plan: [CompoundName, number][];
  stopCount: number;
  pitStopLaps?: number[];
  scTimeSavings?: number;
}
