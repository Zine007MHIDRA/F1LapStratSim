/**
 * carModel.ts
 * Formula 1 vehicle dynamics, aerodynamic maps, and hybrid powertrain definitions.
 * Matches the validated physics models from car_model.py.
 */

import { CarParams } from './types';

export const G = 9.81;
export const AIR_DENSITY_STANDARD = 1.225;

/**
 * Computes ISA-barometric air density (kg/m^3) based on altitude and surface temperature.
 */
export function airDensity(trackTempC: number = 30.0, altitudeM: number = 100.0): number {
  const alt = Math.max(0.0, Math.min(2500.0, altitudeM));
  const tKelvin = 273.15 + Math.max(5.0, Math.min(65.0, trackTempC));
  const pPa = 101325.0 * Math.pow(1.0 - 2.25577e-5 * alt, 5.25588);
  const rSpecific = 287.05; // J / (kg * K) for dry air
  const rho = pPa / (rSpecific * tKelvin);
  return Math.max(0.95, Math.min(1.30, rho));
}

export interface TrackEnvConfig {
  altitudeM: number;
  trackTempC: number;
  airTempC: number;
}

export const TRACK_ENV_PRESETS: Record<string, TrackEnvConfig> = {
  "Monza": { altitudeM: 162, trackTempC: 42.0, airTempC: 27.0 },
  "Silverstone": { altitudeM: 153, trackTempC: 30.0, airTempC: 19.0 },
  "Spa-Francorchamps": { altitudeM: 401, trackTempC: 28.0, airTempC: 17.0 },
  "Monaco": { altitudeM: 10, trackTempC: 40.0, airTempC: 24.0 },
  "Suzuka": { altitudeM: 45, trackTempC: 35.0, airTempC: 20.0 },
  "Bahrain": { altitudeM: 7, trackTempC: 29.0, airTempC: 26.0 },
  "Red Bull Ring": { altitudeM: 678, trackTempC: 44.0, airTempC: 26.0 },
  "Interlagos": { altitudeM: 785, trackTempC: 45.0, airTempC: 24.0 },
  "COTA": { altitudeM: 220, trackTempC: 40.0, airTempC: 28.0 },
};

/**
 * 2025 FIA Regulation Car Model (1.6L V6 Turbo ICE + 120kW MGU-K + Fixed Wing & DRS).
 */
export function car2025(trackName: string = "Monza", trim: 'qualifying' | 'race' = 'qualifying'): CarParams {
  const env = TRACK_ENV_PRESETS[trackName] || TRACK_ENV_PRESETS["Monza"];
  const rho = airDensity(env.trackTempC, env.altitudeM);

  const presets2025: Record<string, { CdA: number; ClA: number; topSpeedKmh: number }> = {
    "Monza": { CdA: 0.80, ClA: 3.20, topSpeedKmh: 372.0 },
    "Silverstone": { CdA: 0.95, ClA: 4.10, topSpeedKmh: 305.0 },
    "Spa-Francorchamps": { CdA: 0.90, ClA: 3.80, topSpeedKmh: 345.0 },
    "Monaco": { CdA: 1.15, ClA: 5.20, topSpeedKmh: 289.0 },
    "Suzuka": { CdA: 0.92, ClA: 4.15, topSpeedKmh: 325.0 },
    "Bahrain": { CdA: 0.94, ClA: 3.90, topSpeedKmh: 315.0 },
    "Red Bull Ring": { CdA: 0.88, ClA: 3.75, topSpeedKmh: 324.0 },
    "Interlagos": { CdA: 0.92, ClA: 3.95, topSpeedKmh: 336.0 },
    "COTA": { CdA: 0.94, ClA: 4.05, topSpeedKmh: 324.0 },
  };

  const aero = presets2025[trackName] || presets2025["Monza"];
  const fuel = trim === 'race' ? 105.0 : 5.0; // kg
  const massEmpty = 798.0;

  return {
    name: "2025 Formula 1 Regulation Car",
    era: "2025",
    trim,
    massEmpty,
    fuelMass: fuel,
    totalMass: massEmpty + fuel,
    rho,
    topSpeedKmh: aero.topSpeedKmh,
    CdA: aero.CdA,
    ClA: aero.ClA,
    drsCdReduction: 0.25,
    drsAvailable: true,
    icePowerW: 560_000.0, // ~750 hp
    mgukPowerW: 120_000.0, // 120 kW (160 hp) cap
    batteryCapacityJ: 4_000_000.0, // 4 MJ store
    mgukDeployBudgetJ: 4_000_000.0, // 4 MJ / lap regulatory cap
    regenEfficiency: 0.85,
    tyreMu: 1.70,
    frictionEllipseP: 1.6,
    maxDecelG: 5.5,
  };
}

/**
 * 2026 FIA Next-Gen Car Model (~400kW ICE + 350kW MGU-K + Active Aero Z/X modes).
 */
export function car2026(trackName: string = "Monza", trim: 'qualifying' | 'race' = 'qualifying'): CarParams {
  const env = TRACK_ENV_PRESETS[trackName] || TRACK_ENV_PRESETS["Monza"];
  const rho = airDensity(env.trackTempC, env.altitudeM);

  const presets2026: Record<string, { cornerClA: number; straightCdA: number; topSpeedKmh: number }> = {
    "Monza": { cornerClA: 2.44, straightCdA: 0.65, topSpeedKmh: 368.0 },
    "Silverstone": { cornerClA: 3.10, straightCdA: 0.72, topSpeedKmh: 344.0 },
    "Spa-Francorchamps": { cornerClA: 2.85, straightCdA: 0.68, topSpeedKmh: 340.0 },
    "Monaco": { cornerClA: 3.80, straightCdA: 0.85, topSpeedKmh: 285.0 },
    "Suzuka": { cornerClA: 3.15, straightCdA: 0.70, topSpeedKmh: 330.0 },
    "Bahrain": { cornerClA: 2.95, straightCdA: 0.71, topSpeedKmh: 328.0 },
    "Red Bull Ring": { cornerClA: 2.80, straightCdA: 0.66, topSpeedKmh: 335.0 },
    "Interlagos": { cornerClA: 3.00, straightCdA: 0.69, topSpeedKmh: 338.0 },
    "COTA": { cornerClA: 3.05, straightCdA: 0.71, topSpeedKmh: 330.0 },
  };

  const aero = presets2026[trackName] || presets2026["Monza"];
  const fuel = trim === 'race' ? 95.0 : 4.0;
  const massEmpty = 768.0; // 30 kg lighter

  return {
    name: "2026 Active Aero F1 Car",
    era: "2026",
    trim,
    massEmpty,
    fuelMass: fuel,
    totalMass: massEmpty + fuel,
    rho,
    topSpeedKmh: aero.topSpeedKmh,
    CdA: aero.straightCdA,
    ClA: aero.cornerClA,
    straightCdA: aero.straightCdA,
    cornerClA: aero.cornerClA,
    drsCdReduction: 0.0, // Active aero replaces DRS
    drsAvailable: false,
    icePowerW: 400_000.0, // ~535 hp
    mgukPowerW: 350_000.0, // 350 kW (~470 hp)
    batteryCapacityJ: 5_400_000.0, // Scaled store
    mgukDeployBudgetJ: null, // No MGU-H -> store depletes
    regenEfficiency: 0.85,
    tyreMu: 1.65,
    frictionEllipseP: 1.6,
    maxDecelG: 5.5,
  };
}

/**
 * Computes aerodynamic downforce (Newtons) at a given speed.
 */
export function downforceForce(vMps: number, car: CarParams, isCorner: boolean = true): number {
  const cla = (car.era === '2026' && car.cornerClA && isCorner) ? car.cornerClA : car.ClA;
  return 0.5 * car.rho * cla * vMps * vMps;
}

/**
 * Computes aerodynamic drag (Newtons) at a given speed, accounting for DRS / active aero.
 */
export function dragForce(vMps: number, car: CarParams, isDrsOpen: boolean = false): number {
  let cda = car.CdA;
  if (car.era === '2026' && car.straightCdA && isDrsOpen) {
    cda = car.straightCdA;
  } else if (isDrsOpen && car.drsAvailable) {
    cda = car.CdA * (1.0 - car.drsCdReduction);
  }
  return 0.5 * car.rho * cda * vMps * vMps;
}

/**
 * Normal tire load sensitivity: grip coefficient slightly reduces under extreme aero load.
 */
export function loadSensitiveMu(car: CarParams, verticalLoadN: number): number {
  const mg = car.totalMass * G;
  const ratio = Math.max(0.2, verticalLoadN / mg);
  return car.tyreMu * Math.pow(ratio, -0.05);
}

/**
 * Maximum sustainable cornering speed (m/s) for a given radius.
 */
export function maxCornerSpeed(radiusM: number, car: CarParams): number {
  if (radiusM <= 0 || !isFinite(radiusM)) {
    return car.topSpeedKmh / 3.6;
  }
  const m = car.totalMass;
  const cla = car.era === '2026' && car.cornerClA ? car.cornerClA : car.ClA;

  // Initial estimate
  let v = Math.sqrt((car.tyreMu * G * radiusM) / Math.max(0.1, 1.0 - (0.5 * car.rho * cla * car.tyreMu * radiusM) / m));
  if (isNaN(v) || v > car.topSpeedKmh / 3.6) {
    v = car.topSpeedKmh / 3.6;
  }

  // Refine with load sensitivity
  for (let iter = 0; iter < 3; iter++) {
    const fz = m * G + downforceForce(v, car, true);
    const mu = loadSensitiveMu(car, fz);
    const denom = m / radiusM - 0.5 * car.rho * cla * mu;
    if (denom <= 0) {
      v = car.topSpeedKmh / 3.6;
      break;
    }
    v = Math.sqrt((mu * m * G) / denom);
  }

  return Math.min(v, car.topSpeedKmh / 3.6);
}

/**
 * Maximum traction acceleration (m/s^2) out of corners and along straights.
 */
export function maxTractionAccel(
  vMps: number,
  car: CarParams,
  latGDemand: number = 0.0,
  isDrsOpen: boolean = false,
  ersPowerLimitW: number | null = null,
): number {
  const v = Math.max(1.0, vMps);
  const m = car.totalMass;

  // Powertrain power available
  let mguk = car.mgukPowerW;
  if (ersPowerLimitW !== null) {
    mguk = Math.min(mguk, Math.max(0.0, ersPowerLimitW));
  }
  const totalPower = car.icePowerW + mguk;
  const aEngine = totalPower / (m * v);

  // Tire grip limit (friction ellipse)
  const fz = m * G + downforceForce(v, car, false);
  const mu = loadSensitiveMu(car, fz);
  const aLongMax = (mu * fz) / m;
  const aLatMax = (mu * fz) / m;

  const latRatio = Math.min(0.999, (Math.abs(latGDemand) * G) / Math.max(0.1, aLatMax));
  const gripRemainingFraction = Math.pow(Math.max(0.0, 1.0 - Math.pow(latRatio, car.frictionEllipseP)), 1.0 / car.frictionEllipseP);
  const aTractionLimit = aLongMax * gripRemainingFraction;

  // Aero drag resistance
  const fDrag = dragForce(v, car, isDrsOpen);
  const aDrag = fDrag / m;

  const aNet = Math.min(aEngine, aTractionLimit) - aDrag;
  return Math.max(0.0, aNet);
}

/**
 * Maximum braking deceleration (m/s^2), subject to tyre grip and 5.5g carbon ceiling.
 */
export function maxBrakeDecel(
  vMps: number,
  car: CarParams,
  latGDemand: number = 0.0,
): number {
  const v = Math.max(1.0, vMps);
  const m = car.totalMass;

  const fz = m * G + downforceForce(v, car, true);
  const mu = loadSensitiveMu(car, fz);
  const aLongMax = (mu * fz) / m;
  const aLatMax = (mu * fz) / m;

  const latRatio = Math.min(0.999, (Math.abs(latGDemand) * G) / Math.max(0.1, aLatMax));
  const gripRemainingFraction = Math.pow(Math.max(0.0, 1.0 - Math.pow(latRatio, car.frictionEllipseP)), 1.0 / car.frictionEllipseP);
  const aTireBrake = aLongMax * gripRemainingFraction;

  const fDrag = dragForce(v, car, false);
  const aDrag = fDrag / m;

  // Cap with carbon brake mechanical ceiling (e.g. 5.5 g)
  const aBrakeCeiling = car.maxDecelG * G;
  const aBrake = Math.min(aTireBrake, aBrakeCeiling) + aDrag;

  return Math.max(1.0, aBrake);
}
