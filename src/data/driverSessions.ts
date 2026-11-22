/**
 * driverSessions.ts
 * Authentic driver profiles, team liveries, and session telemetry stats
 * across all Grand Prix circuits for Qualifying, Race, and Free Practice.
 */

import { getParticipatingDrivers, RaceParticipant } from './raceParticipants';

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
    id: 'ant',
    code: 'ANT',
    name: 'Andrea Kimi Antonelli',
    number: 12,
    team: 'Mercedes-AMG PETRONAS',
    teamColor: '#27F4D2',
    accentColor: '#FFFFFF',
    country: '🇮🇹',
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
    id: 'str',
    code: 'STR',
    name: 'Lance Stroll',
    number: 18,
    team: 'Aston Martin Aramco',
    teamColor: '#229971',
    accentColor: '#FFFFFF',
    country: '🇨🇦',
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
  {
    id: 'alb',
    code: 'ALB',
    name: 'Alexander Albon',
    number: 23,
    team: 'Williams Racing',
    teamColor: '#00A0DE',
    accentColor: '#E10600',
    country: '🇹🇭',
  },
  {
    id: 'col',
    code: 'COL',
    name: 'Franco Colapinto',
    number: 43,
    team: 'Williams Racing',
    teamColor: '#00A0DE',
    accentColor: '#75AADB',
    country: '🇦🇷',
  },
  {
    id: 'per',
    code: 'PER',
    name: 'Sergio Perez',
    number: 11,
    team: 'Red Bull Racing',
    teamColor: '#3671C6',
    accentColor: '#FFDE00',
    country: '🇲🇽',
  },
  {
    id: 'gas',
    code: 'GAS',
    name: 'Pierre Gasly',
    number: 10,
    team: 'Alpine F1 Team',
    teamColor: '#0090FF', // Alpine Blue
    accentColor: '#FF87BC',
    country: '🇫🇷',
  },
  {
    id: 'doo',
    code: 'DOO',
    name: 'Jack Doohan',
    number: 7,
    team: 'Alpine F1 Team',
    teamColor: '#0090FF',
    accentColor: '#FF87BC',
    country: '🇦🇺',
  },
  {
    id: 'tsu',
    code: 'TSU',
    name: 'Yuki Tsunoda',
    number: 22,
    team: 'Racing Bulls (VCARB)',
    teamColor: '#6692FF', // VCARB Blue
    accentColor: '#FFFFFF',
    country: '🇯🇵',
  },
  {
    id: 'law',
    code: 'LAW',
    name: 'Liam Lawson',
    number: 30,
    team: 'Racing Bulls (VCARB)',
    teamColor: '#6692FF',
    accentColor: '#CC1E4A',
    country: '🇳🇿',
  },
  {
    id: 'had',
    code: 'HAD',
    name: 'Isack Hadjar',
    number: 6,
    team: 'Racing Bulls (VCARB)',
    teamColor: '#6692FF',
    accentColor: '#FFFFFF',
    country: '🇫🇷',
  },
  {
    id: 'hul',
    code: 'HUL',
    name: 'Nico Hülkenberg',
    number: 27,
    team: 'Kick Sauber / Audi',
    teamColor: '#52E252', // Stake Neon Green
    accentColor: '#FFFFFF',
    country: '🇩🇪',
  },
  {
    id: 'bor',
    code: 'BOR',
    name: 'Gabriel Bortoleto',
    number: 5,
    team: 'Kick Sauber / Audi',
    teamColor: '#52E252',
    accentColor: '#00E5FF',
    country: '🇧🇷',
  },
  {
    id: 'oco',
    code: 'OCO',
    name: 'Esteban Ocon',
    number: 31,
    team: 'Haas F1 Team',
    teamColor: '#B6BABD', // Haas Grey / White
    accentColor: '#E10600',
    country: '🇫🇷',
  },
  {
    id: 'bea',
    code: 'BEA',
    name: 'Oliver Bearman',
    number: 87,
    team: 'Haas F1 Team',
    teamColor: '#B6BABD',
    accentColor: '#FFFFFF',
    country: '🇬🇧',
  },
  {
    id: 'mag',
    code: 'MAG',
    name: 'Kevin Magnussen',
    number: 20,
    team: 'Haas F1 Team',
    teamColor: '#B6BABD',
    accentColor: '#E10600',
    country: '🇩🇰',
  },
  {
    id: 'ric',
    code: 'RIC',
    name: 'Daniel Ricciardo',
    number: 3,
    team: 'Racing Bulls (VCARB)',
    teamColor: '#6692FF',
    accentColor: '#FFFFFF',
    country: '🇦🇺',
  },
  {
    id: 'bot',
    code: 'BOT',
    name: 'Valtteri Bottas',
    number: 77,
    team: 'Kick Sauber',
    teamColor: '#52E252',
    accentColor: '#00E5FF',
    country: '🇫🇮',
  },
  {
    id: 'zho',
    code: 'ZHO',
    name: 'Zhou Guanyu',
    number: 24,
    team: 'Kick Sauber',
    teamColor: '#52E252',
    accentColor: '#FFFFFF',
    country: '🇨🇳',
  },
  {
    id: 'sar',
    code: 'SAR',
    name: 'Logan Sargeant',
    number: 2,
    team: 'Williams Racing',
    teamColor: '#00A0DE',
    accentColor: '#FFFFFF',
    country: '🇺🇸',
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

// Default driver relative pace offsets (fallback when circuit-specific participant row has no override)
const DRIVER_OFFSETS: Record<string, { qDelta: number; rDelta: number; pDelta: number; speedDelta: number }> = {
  nor: { qDelta: 0.000, rDelta: 0.040, pDelta: 0.020, speedDelta: +1.5 },
  ver: { qDelta: 0.020, rDelta: -0.050, pDelta: 0.010, speedDelta: +2.0 },
  lec: { qDelta: 0.080, rDelta: 0.120, pDelta: 0.090, speedDelta: +2.5 },
  ham: { qDelta: 0.150, rDelta: 0.100, pDelta: 0.140, speedDelta: +0.5 },
  pia: { qDelta: 0.110, rDelta: 0.160, pDelta: 0.130, speedDelta: +1.0 },
  rus: { qDelta: 0.140, rDelta: 0.180, pDelta: 0.150, speedDelta: +0.0 },
  ant: { qDelta: 0.280, rDelta: 0.320, pDelta: 0.290, speedDelta: -0.5 },
  alo: { qDelta: 0.380, rDelta: 0.420, pDelta: 0.350, speedDelta: -2.0 },
  str: { qDelta: 0.520, rDelta: 0.560, pDelta: 0.480, speedDelta: -1.5 },
  sai: { qDelta: 0.350, rDelta: 0.390, pDelta: 0.320, speedDelta: -1.0 },
  alb: { qDelta: 0.480, rDelta: 0.510, pDelta: 0.450, speedDelta: +1.0 },
  col: { qDelta: 0.550, rDelta: 0.590, pDelta: 0.520, speedDelta: +0.5 },
  per: { qDelta: 0.380, rDelta: 0.420, pDelta: 0.350, speedDelta: +1.2 },
  gas: { qDelta: 0.510, rDelta: 0.550, pDelta: 0.480, speedDelta: -1.8 },
  doo: { qDelta: 0.620, rDelta: 0.650, pDelta: 0.580, speedDelta: -1.2 },
  tsu: { qDelta: 0.490, rDelta: 0.530, pDelta: 0.460, speedDelta: -0.5 },
  law: { qDelta: 0.540, rDelta: 0.570, pDelta: 0.500, speedDelta: +0.2 },
  had: { qDelta: 0.650, rDelta: 0.680, pDelta: 0.600, speedDelta: -0.8 },
  hul: { qDelta: 0.500, rDelta: 0.540, pDelta: 0.480, speedDelta: +0.8 },
  bor: { qDelta: 0.670, rDelta: 0.700, pDelta: 0.620, speedDelta: -0.5 },
  oco: { qDelta: 0.530, rDelta: 0.570, pDelta: 0.500, speedDelta: -1.5 },
  bea: { qDelta: 0.580, rDelta: 0.610, pDelta: 0.540, speedDelta: -0.2 },
  mag: { qDelta: 0.560, rDelta: 0.590, pDelta: 0.520, speedDelta: +0.5 },
  ric: { qDelta: 0.570, rDelta: 0.610, pDelta: 0.530, speedDelta: -0.8 },
  bot: { qDelta: 0.640, rDelta: 0.680, pDelta: 0.600, speedDelta: -1.2 },
  zho: { qDelta: 0.710, rDelta: 0.750, pDelta: 0.660, speedDelta: -1.5 },
  sar: { qDelta: 0.780, rDelta: 0.820, pDelta: 0.720, speedDelta: +0.5 },
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
  session: SessionType = 'qualifying',
  era: '2025' | '2026' = '2025'
): DriverSessionStats {
  const participants = getParticipatingDrivers(circuitId, era);
  const part = participants.find((p) => p.driverId === driverId);
  const offsets = DRIVER_OFFSETS[driverId] || DRIVER_OFFSETS.nor;
  const driver = getDriver(driverId);

  const f1 = sectorFractions[0];
  const f2 = sectorFractions[1] - sectorFractions[0];
  const f3 = 1.0 - sectorFractions[1];

  let baseDelta = part ? part.deltaToPole : offsets.qDelta;
  let compound: 'soft' | 'medium' | 'hard' = 'soft';
  let fuelKg = 5;
  let tyreAgeLaps = 2;
  let topSpeed = part?.topSpeedKmh || (topSpeedKmh + offsets.speedDelta);

  let sessionDelta = baseDelta;

  if (session === 'qualifying') {
    sessionDelta = baseDelta;
    compound = 'soft';
    fuelKg = 5;
    tyreAgeLaps = 2;
  } else if (session === 'race') {
    sessionDelta = baseDelta + 3.2 + offsets.rDelta;
    compound = 'medium';
    fuelKg = 65;
    tyreAgeLaps = 16;
    topSpeed = topSpeed - 11;
  } else {
    sessionDelta = baseDelta + 1.8 + offsets.pDelta;
    compound = 'medium';
    fuelKg = 30;
    tyreAgeLaps = 8;
    topSpeed = topSpeed - 5;
  }

  const baseTime = poleLapTime + sessionDelta;
  const speedMult = poleLapTime / Math.max(baseTime, 1.0);

  const s1 = parseFloat((baseTime * f1).toFixed(3));
  const s2 = parseFloat((baseTime * f2).toFixed(3));
  const s3 = parseFloat((baseTime * f3).toFixed(3));

  const note = part?.note
    ? part.note
    : session === 'qualifying'
    ? `${driver.name} Q3 Hot-lap • ${formatSecondsToLap(baseTime)} (${sessionDelta <= 0 ? 'POLE BENCHMARK' : `+${sessionDelta.toFixed(3)}s vs Pole`})`
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
    deltaToPole: sessionDelta,
    speedMultiplier: speedMult,
    note,
  };
}
