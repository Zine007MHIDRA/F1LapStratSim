import { CircuitData, CircuitSummary } from '../engine/types';

import bahrainData from './circuits/bahrain.json';
import jeddahData from './circuits/jeddah.json';
import albertParkData from './circuits/albert_park.json';
import suzukaData from './circuits/suzuka.json';
import shanghaiData from './circuits/shanghai.json';
import miamiData from './circuits/miami.json';
import imolaData from './circuits/imola.json';
import monacoData from './circuits/monaco.json';
import montrealData from './circuits/montreal.json';
import barcelonaData from './circuits/barcelona.json';
import redBullRingData from './circuits/red_bull_ring.json';
import silverstoneData from './circuits/silverstone.json';
import hungaroringData from './circuits/hungaroring.json';
import spaData from './circuits/spa.json';
import zandvoortData from './circuits/zandvoort.json';
import monzaData from './circuits/monza.json';
import bakuData from './circuits/baku.json';
import singaporeData from './circuits/singapore.json';
import cotaData from './circuits/cota.json';
import mexicoCityData from './circuits/mexico_city.json';
import interlagosData from './circuits/interlagos.json';
import lasVegasData from './circuits/las_vegas.json';
import lusailData from './circuits/lusail.json';
import yasMarinaData from './circuits/yas_marina.json';
import indexData from './circuits/index.json';

export const CIRCUITS: Record<string, CircuitData> = {
  bahrain: bahrainData as unknown as CircuitData,
  jeddah: jeddahData as unknown as CircuitData,
  albert_park: albertParkData as unknown as CircuitData,
  suzuka: suzukaData as unknown as CircuitData,
  shanghai: shanghaiData as unknown as CircuitData,
  miami: miamiData as unknown as CircuitData,
  imola: imolaData as unknown as CircuitData,
  monaco: monacoData as unknown as CircuitData,
  montreal: montrealData as unknown as CircuitData,
  barcelona: barcelonaData as unknown as CircuitData,
  red_bull_ring: redBullRingData as unknown as CircuitData,
  silverstone: silverstoneData as unknown as CircuitData,
  hungaroring: hungaroringData as unknown as CircuitData,
  spa: spaData as unknown as CircuitData,
  zandvoort: zandvoortData as unknown as CircuitData,
  monza: monzaData as unknown as CircuitData,
  baku: bakuData as unknown as CircuitData,
  singapore: singaporeData as unknown as CircuitData,
  cota: cotaData as unknown as CircuitData,
  mexico_city: mexicoCityData as unknown as CircuitData,
  interlagos: interlagosData as unknown as CircuitData,
  las_vegas: lasVegasData as unknown as CircuitData,
  lusail: lusailData as unknown as CircuitData,
  yas_marina: yasMarinaData as unknown as CircuitData,
};

export const CIRCUITS_LIST: CircuitSummary[] = indexData as CircuitSummary[];

export function getCircuit(id: string): CircuitData {
  const norm = id.toLowerCase().replace(/[\s-]/g, '_');
  return CIRCUITS[norm] || CIRCUITS['monza'];
}
