import { getCircuit } from './circuits';
import { CircuitData } from '../engine/types';

export interface RaceWeekendInfo {
  circuitId: string;
  round: number;
  gpName: string;
  circuitFullName: string;
  location: string;
  country: string;
  flag: string;
  status: string; // e.g. "NEXT GP // RACE DAY TOMORROW"
  sessionTiming: string; // e.g. "RACE START: 14:00 LOCAL (20:00 UTC)"
  trackTempC: number;
  airTempC: number;
  humidityPct: number;
  windDesc: string;
  poleBenchmark: string;
  circuit: CircuitData;
}

export const F1_CALENDAR: Record<string, RaceWeekendInfo> = {
  cota: {
    circuitId: 'cota',
    round: 19,
    gpName: 'UNITED STATES GRAND PRIX',
    circuitFullName: 'Circuit of the Americas',
    location: 'Austin, Texas, USA',
    country: 'United States',
    flag: '🇺🇸',
    status: 'NEXT GP // RACE DAY TOMORROW',
    sessionTiming: 'RACE START: 14:00 LOCAL (19:00 UTC)',
    trackTempC: 38.6,
    airTempC: 25.4,
    humidityPct: 44,
    windDesc: '4.2 m/s HEADWIND INTO TURN 1',
    poleBenchmark: '1:32.330 (VER)',
    circuit: getCircuit('cota'),
  },
  monza: {
    circuitId: 'monza',
    round: 16,
    gpName: 'ITALIAN GRAND PRIX',
    circuitFullName: 'Autodromo Nazionale Monza',
    location: 'Monza, Lombardy, Italy',
    country: 'Italy',
    flag: '🇮🇹',
    status: 'COMPLETED // ARCHIVED TELEMETRY',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 42.4,
    airTempC: 28.1,
    humidityPct: 54,
    windDesc: '3.4 m/s HEADWIND INTO PRIMA VARIANTE',
    poleBenchmark: '1:18.810 (NOR)',
    circuit: getCircuit('monza'),
  },
  silverstone: {
    circuitId: 'silverstone',
    round: 12,
    gpName: 'BRITISH GRAND PRIX',
    circuitFullName: 'Silverstone Circuit',
    location: 'Silverstone, Northamptonshire, UK',
    country: 'Great Britain',
    flag: '🇬🇧',
    status: 'COMPLETED // HIGH-G DATA RECORDED',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 31.0,
    airTempC: 20.5,
    humidityPct: 62,
    windDesc: '6.8 m/s CROSSWIND AT MAGGOTTS/BECKETTS',
    poleBenchmark: '1:24.890 (VER)',
    circuit: getCircuit('silverstone'),
  },
  spa: {
    circuitId: 'spa',
    round: 14,
    gpName: 'BELGIAN GRAND PRIX',
    circuitFullName: 'Circuit de Spa-Francorchamps',
    location: 'Stavelot, Ardennes, Belgium',
    country: 'Belgium',
    flag: '🇧🇪',
    status: 'COMPLETED // RAIN RADAR LOGGED',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 25.4,
    airTempC: 17.8,
    humidityPct: 78,
    windDesc: '2.1 m/s TAILWIND UP EAU ROUGE/RAIDILLON',
    poleBenchmark: '1:40.560 (VER)',
    circuit: getCircuit('spa'),
  },
  interlagos: {
    circuitId: 'interlagos',
    round: 21,
    gpName: 'SÃO PAULO GRAND PRIX',
    circuitFullName: 'Autódromo José Carlos Pace',
    location: 'São Paulo, Brazil',
    country: 'Brazil',
    flag: '🇧🇷',
    status: 'RECENTLY CONCLUDED',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 36.2,
    airTempC: 23.5,
    humidityPct: 65,
    windDesc: '3.1 m/s SOUTHERLY GUSTS INTO SENNA S',
    poleBenchmark: '1:09.511 (NOR)',
    circuit: getCircuit('interlagos'),
  },
  monaco: {
    circuitId: 'monaco',
    round: 8,
    gpName: 'MONACO GRAND PRIX',
    circuitFullName: 'Circuit de Monaco',
    location: 'Monte Carlo, Principality of Monaco',
    country: 'Monaco',
    flag: '🇲🇨',
    status: 'COMPLETED // QUALIFYING BENCHMARK',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 44.5,
    airTempC: 26.8,
    humidityPct: 58,
    windDesc: '1.2 m/s SEA BREEZE AT TABAC',
    poleBenchmark: '1:09.954 (NOR)',
    circuit: getCircuit('monaco'),
  },
  bahrain: {
    circuitId: 'bahrain',
    round: 1,
    gpName: 'BAHRAIN GRAND PRIX',
    circuitFullName: 'Bahrain International Circuit',
    location: 'Sakhir, Kingdom of Bahrain',
    country: 'Bahrain',
    flag: '🇧🇭',
    status: 'SEASON OPENER ARCHIVE',
    sessionTiming: 'NIGHT RACE COMPLETED',
    trackTempC: 34.0,
    airTempC: 26.0,
    humidityPct: 38,
    windDesc: '5.0 m/s DESERT CROSSWIND INTO T4',
    poleBenchmark: '1:29.841 (PIA)',
    circuit: getCircuit('bahrain'),
  },
  suzuka: {
    circuitId: 'suzuka',
    round: 4,
    gpName: 'JAPANESE GRAND PRIX',
    circuitFullName: 'Suzuka International Racing Course',
    location: 'Suzuka, Mie Prefecture, Japan',
    country: 'Japan',
    flag: '🇯🇵',
    status: 'COMPLETED // HIGH DEGRADATION',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 28.5,
    airTempC: 19.2,
    humidityPct: 50,
    windDesc: '3.8 m/s HEADWIND AT 130R',
    poleBenchmark: '1:26.983 (VER)',
    circuit: getCircuit('suzuka'),
  },
  red_bull_ring: {
    circuitId: 'red_bull_ring',
    round: 11,
    gpName: 'AUSTRIAN GRAND PRIX',
    circuitFullName: 'Red Bull Ring',
    location: 'Spielberg, Styria, Austria',
    country: 'Austria',
    flag: '🇦🇹',
    status: 'COMPLETED // POWER CIRCUIT',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 39.0,
    airTempC: 25.5,
    humidityPct: 42,
    windDesc: '2.5 m/s ALPINE DOWNDRAFT AT T3',
    poleBenchmark: '1:03.971 (NOR)',
    circuit: getCircuit('red_bull_ring'),
  },
  barcelona: {
    circuitId: 'barcelona',
    round: 10,
    gpName: 'SPANISH GRAND PRIX',
    circuitFullName: 'Circuit de Barcelona-Catalunya',
    location: 'Montmeló, Catalonia, Spain',
    country: 'Spain',
    flag: '🇪🇸',
    status: 'COMPLETED // AERO TEST BENCH',
    sessionTiming: 'RACE FINISHED',
    trackTempC: 46.0,
    airTempC: 30.2,
    humidityPct: 48,
    windDesc: '3.0 m/s MEDITERRANEAN HEADWIND AT T1',
    poleBenchmark: '1:11.383 (NOR)',
    circuit: getCircuit('barcelona'),
  },
};

/**
 * Returns the active or upcoming race weekend (defaulting to the USA GP at COTA as requested)
 */
export function getActiveRaceWeekend(): RaceWeekendInfo {
  return F1_CALENDAR['cota'];
}

export function getRaceWeekend(circuitId: string): RaceWeekendInfo {
  const norm = circuitId.toLowerCase().replace(/[\s-]/g, '_');
  return F1_CALENDAR[norm] || F1_CALENDAR['cota'];
}

export const CALENDAR_ROUNDS = Object.values(F1_CALENDAR);
