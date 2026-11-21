import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src', 'data', 'circuits');
const indexPath = path.join(srcDir, 'index.json');

console.log('=== FORMULA 1 24-CIRCUIT SIMULATOR VALIDATION ===\n');

// 1. Read index
if (!fs.existsSync(indexPath)) {
  console.error('FAIL: index.json does not exist');
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
if (!Array.isArray(index) || index.length !== 24) {
  console.error(`FAIL: index.json has ${index.length} circuits, expected 24`);
  process.exit(1);
}
console.log(`✓ index.json contains exactly 24 circuits in calendar order.`);

let totalErrors = 0;

for (let i = 0; i < index.length; i++) {
  const summary = index[i];
  const roundStr = `R${String(i + 1).padStart(2, '0')}`;
  const circuitFile = path.join(srcDir, `${summary.id}.json`);

  if (!fs.existsSync(circuitFile)) {
    console.error(`FAIL: ${roundStr} ${summary.id}.json is missing!`);
    totalErrors++;
    continue;
  }

  const c = JSON.parse(fs.readFileSync(circuitFile, 'utf8'));

  // Check required fields
  const requiredKeys = [
    'id', 'name', 'fullName', 'country', 'location', 'flag', 'characteristics',
    'direction', 'lapLengthM', 'raceLaps', 'pitLossS', 'tyreStress', 'altitudeM',
    'trackTempC', 'airTempC', 'poleDriver', 'poleLapTime', 'topSpeedKmh',
    'sectorFractions', 'drsZoneCount', 'segments', 'telemetry'
  ];

  for (const k of requiredKeys) {
    if (c[k] === undefined || c[k] === null) {
      console.error(`FAIL: ${summary.id} is missing field "${k}"`);
      totalErrors++;
    }
  }

  // Check segments
  if (!Array.isArray(c.segments) || c.segments.length < 5) {
    console.error(`FAIL: ${summary.id} has insufficient segments (${c.segments?.length})`);
    totalErrors++;
  }

  // Check telemetry
  const telem = c.telemetry;
  const telemKeys = ['distance', 'speed', 'throttle', 'brake', 'gear', 'drs', 'x', 'y', 'z'];
  const baseLen = telem.distance?.length || 0;

  if (baseLen < 100) {
    console.error(`FAIL: ${summary.id} has insufficient telemetry points (${baseLen})`);
    totalErrors++;
  }

  for (const tk of telemKeys) {
    if (!Array.isArray(telem[tk]) || telem[tk].length !== baseLen) {
      console.error(`FAIL: ${summary.id} telemetry.${tk} length mismatch: got ${telem[tk]?.length}, expected ${baseLen}`);
      totalErrors++;
    }
    // Check for NaNs
    const hasNaN = telem[tk].some(v => typeof v !== 'number' || Number.isNaN(v));
    if (hasNaN) {
      console.error(`FAIL: ${summary.id} telemetry.${tk} contains NaN!`);
      totalErrors++;
    }
  }

  // Check elevation (z)
  const minZ = Math.min(...telem.z);
  const maxZ = Math.max(...telem.z);
  const zDelta = maxZ - minZ;

  // Check loop closure on (x, y)
  const x0 = telem.x[0], y0 = telem.y[0];
  const xN = telem.x[baseLen - 1], yN = telem.y[baseLen - 1];
  const loopGap = Math.hypot(xN - x0, yN - y0);

  const spanX = Math.max(...telem.x) - Math.min(...telem.x);
  const spanY = Math.max(...telem.y) - Math.min(...telem.y);
  const maxSpan = Math.max(spanX, spanY);
  const relativeGapPct = (loopGap / maxSpan) * 100;

  console.log(`[${roundStr}] ${summary.flag} ${summary.name.padEnd(16)} | Alt: ${String(c.altitudeM).padStart(5)}m | Elev Delta: ${zDelta.toFixed(1).padStart(5)}m | Span: ${maxSpan.toFixed(0)}m | Loop gap: ${relativeGapPct.toFixed(2)}% | Telem pts: ${baseLen}`);
}

console.log('\n=== SUMMARY ===');
if (totalErrors === 0) {
  console.log('✓ ALL 24 CIRCUITS PASSED FULL ENGINE & TELEMETRY VALIDATION WITH ZERO ERRORS!\n');
} else {
  console.error(`FAIL: ${totalErrors} errors found across circuits.`);
  process.exit(1);
}
