import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CALENDAR_ORDER = [
  'bahrain', 'jeddah', 'albert_park', 'suzuka', 'shanghai', 'miami',
  'imola', 'monaco', 'montreal', 'barcelona', 'red_bull_ring', 'silverstone',
  'hungaroring', 'spa', 'zandvoort', 'monza', 'baku', 'singapore',
  'cota', 'mexico_city', 'interlagos', 'las_vegas', 'lusail', 'yas_marina'
];

const srcDir = path.join(__dirname, '..', 'src', 'data', 'circuits');
const pubDir = path.join(__dirname, '..', 'public', 'data', 'circuits');

const summaries = [];
const missing = [];

for (let i = 0; i < CALENDAR_ORDER.length; i++) {
  const id = CALENDAR_ORDER[i];
  const p = path.join(srcDir, `${id}.json`);
  if (!fs.existsSync(p)) {
    missing.push(id);
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  summaries.push({
    id: raw.id,
    name: raw.name,
    fullName: raw.fullName,
    country: raw.country,
    location: raw.location,
    flag: raw.flag,
    characteristics: raw.characteristics,
    direction: raw.direction,
    lapLengthM: raw.lapLengthM,
    raceLaps: raw.raceLaps,
    pitLossS: raw.pitLossS,
    tyreStress: raw.tyreStress,
    altitudeM: raw.altitudeM,
    poleDriver: raw.poleDriver,
    poleLapTime: raw.poleLapTime,
    topSpeedKmh: raw.topSpeedKmh,
    drsZoneCount: raw.drsZoneCount
  });
}

console.log(`Found: ${summaries.length} circuits, Missing: ${missing.length}`);
if (missing.length > 0) {
  console.error('Missing circuits:', missing);
  process.exit(1);
}

const outSrc = path.join(srcDir, 'index.json');
const outPub = path.join(pubDir, 'index.json');

fs.writeFileSync(outSrc, JSON.stringify(summaries, null, 2), 'utf8');
fs.writeFileSync(outPub, JSON.stringify(summaries, null, 2), 'utf8');

console.log('✓ Successfully wrote index.json with all 24 circuits to src and public!');
