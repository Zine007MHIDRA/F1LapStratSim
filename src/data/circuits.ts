import { CircuitData, CircuitSummary } from '../engine/types';

import monzaData from './circuits/monza.json';
import silverstoneData from './circuits/silverstone.json';
import spaData from './circuits/spa.json';
import monacoData from './circuits/monaco.json';
import suzukaData from './circuits/suzuka.json';
import bahrainData from './circuits/bahrain.json';
import redBullRingData from './circuits/red_bull_ring.json';
import interlagosData from './circuits/interlagos.json';
import cotaData from './circuits/cota.json';
import barcelonaData from './circuits/barcelona.json';
import indexData from './circuits/index.json';

export const CIRCUITS: Record<string, CircuitData> = {
  barcelona: barcelonaData as unknown as CircuitData,
  monza: monzaData as unknown as CircuitData,
  silverstone: silverstoneData as unknown as CircuitData,
  spa: spaData as unknown as CircuitData,
  monaco: monacoData as unknown as CircuitData,
  suzuka: suzukaData as unknown as CircuitData,
  bahrain: bahrainData as unknown as CircuitData,
  red_bull_ring: redBullRingData as unknown as CircuitData,
  interlagos: interlagosData as unknown as CircuitData,
  cota: cotaData as unknown as CircuitData,
};

export const CIRCUITS_LIST: CircuitSummary[] = indexData as CircuitSummary[];

export function getCircuit(id: string): CircuitData {
  const norm = id.toLowerCase().replace(/[\s-]/g, '_');
  return CIRCUITS[norm] || CIRCUITS['monza'];
}
