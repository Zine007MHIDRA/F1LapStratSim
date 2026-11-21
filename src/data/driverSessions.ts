/**
 * driverSessions.ts
 * Authentic driver profiles, team liveries, and session telemetry stats
 * across all Grand Prix circuits for Qualifying, Race, and Free Practice.
 */

export interface DriverProfile {
  id: string;
  code: string;
  name: string;
  number: number;
  team: string;
  teamColor: string;
  accentColor: string;
  country: string;
}

export type SessionType = 'qualifying' | 'race' | 'practice';

export interface DriverSessionStats {
  driverId: string;
  circuitId: string;
  session: SessionType;
  lapTime: number; // seconds
  lapTimeStr: string;
  s1: number;
  s2: number;
  s3: number;
  topSpeedKmh: number;
  compound: 'soft' | 'medium' | 'hard';
  fuelKg: number;
  tyreAgeLaps: number;
  deltaToPole: number; // positive = slower, 0 = pole
  speedMultiplier: number; // relative pace multiplier vs pole benchmark
  note: string;
}

export const DRIVERS: DriverProfile[] = [
  {
    id: 'nor',
    code: 'NOR',
    name: 'Lando Norris',
    number: 4,
    team: 'McLaren Mercedes',
    teamColor: '#FF8000', // Papaya
    accentColor: '#47C7FC',
    country: '🇬🇧',
  },
  {
    id: 'ver',
    code: 'VER',
    name: 'Max Verstappen',
    number: 1,
    team: 'Red Bull Racing',
    teamColor: '#3671C6', // Racing Navy
    accentColor: '#CC1E4A',
    country: '🇳🇱',
  },
  {
    id: 'lec',
    code: 'LEC',
    name: 'Charles Leclerc',
    number: 16,
    team: 'Scuderia Ferrari',
    teamColor: '#E80020', // Rosso Corsa
    accentColor: '#FFF200',
    country: '🇲🇨',
  },
  {
    id: 'ham',
    code: 'HAM',
    name: 'Lewis Hamilton',
    number: 44,
    team: 'Scuderia Ferrari',
    teamColor: '#E80020',
    accentColor: '#FFFFFF',
    country: '🇬🇧',
  },
  {
    id: 'pia',
    code: 'PIA',
    name: 'Oscar Piastri',
    number: 81,
    team: 'McLaren Mercedes',
    teamColor: '#FF8000',
    accentColor: '#47C7FC',
    country: '🇦🇺',
  },
  {
    id: 'rus',
    code: 'RUS',
    name: 'George Russell',
    number: 63,
    team: 'Mercedes-AMG PETRONAS',
    teamColor: '#27F4D2', // Petronas Teal
    accentColor: '#C0C0C0',
    country: '🇬🇧',
  },
  {
    id: 'alo',
    code: 'ALO',
    name: 'Fernando Alonso',
    number: 14,
    team: 'Aston Martin Aramco',
    teamColor: '#229971', // British Racing Green
    accentColor: '#CEDC00',
    country: '🇪🇸',
  },
  {
    id: 'sai',
    code: 'SAI',
    name: 'Carlos Sainz',
    number: 55,
    team: 'Williams Racing',
    teamColor: '#00A0DE', // Williams Blue
    accentColor: '#002B49',
    country: '🇪🇸',
  },
];

export const SESSIONS_LIST: { id: SessionType; label: string; icon: string; desc: string }[] = [
  { id: 'qualifying', label: 'QUALIFYING (Q3)', icon: '⚡', desc: 'Maximum attack, 5kg fuel, Soft tyres, all DRS zones' },
  { id: 'race', label: 'RACE (GP STINT)', icon: '🏁', desc: 'Representative race stint pace, 60kg fuel, Medium tyre management' },
  { id: 'practice', label: 'FREE PRACTICE (FP2)', icon: '⏱️', desc: 'Baseline evaluation setup run, 30kg fuel' },
];

export function formatSecondsToLap(timeS: number): string {
  const mins = Math.floor(timeS / 60);
  const secs = (timeS % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
}

// Circuit-specific driver benchmark records
// Relative pace offsets to compute realistic authentic session stats for any circuit
const DRIVER_OFFSETS: Record<string, { qDelta: number; rDelta: number; pDelta: number; speedDelta: number }> = {
  nor: { qDelta: 0.000, rDelta: 0.040, pDelta: 0.020, speedDelta: +1.5 },
  ver: { qDelta: 0.020, rDelta: -0.050, pDelta: 0.010, speedDelta: +2.0 },
  lec: { qDelta: 0.080, rDelta: 0.120, pDelta: 0.090, speedDelta: +2.5 },
  ham: { qDelta: 0.150, rDelta: 0.100, pDelta: 0.140, speedDelta: +0.5 },
  pia: { qDelta: 0.110, rDelta: 0.160, pDelta: 0.130, speedDelta: +1.0 },
  rus: { qDelta: 0.140, rDelta: 0.180, pDelta: 0.150, speedDelta: +0.0 },
  alo: { qDelta: 0.380, rDelta: 0.420, pDelta: 0.350, speedDelta: -2.0 },
  sai: { qDelta: 0.350, rDelta: 0.390, pDelta: 0.320, speedDelta: -1.0 },
};

export function getDriver(id: string): DriverProfile {
  return DRIVERS.find((d) => d.id === id) || DRIVERS[0];
}

export function getDriverSessionStats(
  circuitId: string,
  poleLapTime: number,
  topSpeedKmh: number,
  sectorFractions: [number, number],
  driverId: string = 'nor',
  session: SessionType = 'qualifying'
): DriverSessionStats {
  const offsets = DRIVER_OFFSETS[driverId] || DRIVER_OFFSETS.nor;
  const f1 = sectorFractions[0];
  const f2 = sectorFractions[1] - sectorFractions[0];
  const f3 = 1.0 - sectorFractions[1];

  let baseTime = poleLapTime;
  let compound: 'soft' | 'medium' | 'hard' = 'soft';
  let fuelKg = 5;
  let tyreAgeLaps = 2;
  let speedMult = 1.0;
  let topSpeed = topSpeedKmh + offsets.speedDelta;
  let delta = 0;

  if (session === 'qualifying') {
    delta = offsets.qDelta;
    baseTime = poleLapTime + delta;
    compound = 'soft';
    fuelKg = 5;
    tyreAgeLaps = 2;
    speedMult = poleLapTime / baseTime;
  } else if (session === 'race') {
    // Race pace is ~4.5% - 5.5% slower due to fuel load and tyre preservation
    delta = offsets.rDelta + poleLapTime * 0.052;
    baseTime = poleLapTime + delta;
    compound = 'medium';
    fuelKg = 65;
    tyreAgeLaps = 16;
    topSpeed = topSpeed - 11; // No continuous DRS, lower engine modes
    speedMult = poleLapTime / baseTime;
  } else {
    // Practice pace is ~2.2% slower (setup evaluation run)
    delta = offsets.pDelta + poleLapTime * 0.024;
    baseTime = poleLapTime + delta;
    compound = 'medium';
    fuelKg = 30;
    tyreAgeLaps = 8;
    topSpeed = topSpeed - 5;
    speedMult = poleLapTime / baseTime;
  }

  const s1 = parseFloat((baseTime * f1).toFixed(3));
  const s2 = parseFloat((baseTime * f2).toFixed(3));
  const s3 = parseFloat((baseTime * f3).toFixed(3));

  const driver = getDriver(driverId);
  const note =
    session === 'qualifying'
      ? `${driver.name} Q3 Hot-lap • ${formatSecondsToLap(baseTime)} (${delta <= 0 ? 'POLE BENCHMARK' : `+${delta.toFixed(3)}s vs Pole`})`
      : session === 'race'
      ? `${driver.name} Race Stint Pace • ${formatSecondsToLap(baseTime)} on Medium C2 (Fuel: ${fuelKg}kg)`
      : `${driver.name} FP2 Long Run • ${formatSecondsToLap(baseTime)} (Setup calibration)`;

  return {
    driverId,
    circuitId,
    session,
    lapTime: baseTime,
    lapTimeStr: formatSecondsToLap(baseTime),
    s1,
    s2,
    s3,
    topSpeedKmh: parseFloat(topSpeed.toFixed(1)),
    compound,
    fuelKg,
    tyreAgeLaps,
    deltaToPole: delta,
    speedMultiplier: speedMult,
    note,
  };
}
