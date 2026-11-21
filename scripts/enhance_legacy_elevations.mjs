import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src', 'data', 'circuits');
const pubDir = path.join(__dirname, '..', 'public', 'data', 'circuits');

// Elevation profiles: array of { distPct: 0..1, zOffset: meters relative to base }
const LEGACY_ELEVATIONS = {
  spa: {
    baseAlt: 401,
    keyframes: [
      { pct: 0.00, z: 0.0 },    // Start/Finish straight (La Source approach)
      { pct: 0.05, z: -5.0 },   // Descent past La Source exit
      { pct: 0.12, z: -18.0 },  // Bottom of Eau Rouge compression (lowest point)
      { pct: 0.18, z: +42.0 },  // Cresting Raidillon (steep 17% climb)
      { pct: 0.28, z: +84.0 },  // Kemmel Straight ascent
      { pct: 0.35, z: +102.2 }, // Highest point at Les Combes (Turn 7)
      { pct: 0.45, z: +65.0 },  // Downhill through Bruxelles / Rivage
      { pct: 0.58, z: +28.0 },  // Fast downhill double-apex Pouhon
      { pct: 0.72, z: +5.0 },   // Stavelot curve (valley)
      { pct: 0.85, z: +12.0 },  // Paul Frere & Blanchimont run
      { pct: 0.95, z: +4.0 },   // Bus Stop Chicane
      { pct: 1.00, z: 0.0 },    // Return to start line
    ]
  },
  barcelona: {
    baseAlt: 110,
    keyframes: [
      { pct: 0.00, z: 0.0 },    // Pit Straight
      { pct: 0.10, z: -4.0 },   // Turn 1 Elf braking downhill
      { pct: 0.22, z: +16.0 },  // Steep climb through Turn 3 Renault curve
      { pct: 0.32, z: +22.0 },  // Turn 4 Repsol crest
      { pct: 0.40, z: +8.0 },   // Turn 5 Seat downhill hair-pin
      { pct: 0.52, z: +18.0 },  // Turn 7/8 Wurth uphill
      { pct: 0.62, z: +30.5 },  // Peak altitude at Turn 9 Campsa
      { pct: 0.75, z: +4.0 },   // Downhill back straight to Turn 10 Caixa
      { pct: 0.88, z: +8.0 },   // Stadium section (Turn 11-13)
      { pct: 1.00, z: 0.0 },    // Return to start line
    ]
  },
  silverstone: {
    baseAlt: 153,
    keyframes: [
      { pct: 0.00, z: 0.0 },    // Hamilton Straight
      { pct: 0.08, z: -2.5 },   // Abbey & Farm curve
      { pct: 0.16, z: -7.0 },   // Village & The Loop (lowest point)
      { pct: 0.25, z: -4.0 },   // Aintree & Wellington Straight
      { pct: 0.35, z: -6.5 },   // Brooklands & Luffield
      { pct: 0.45, z: -1.0 },   // Woodcote
      { pct: 0.55, z: +4.2 },   // Copse corner crest (highest point)
      { pct: 0.65, z: +1.5 },   // Maggotts downhill
      { pct: 0.75, z: -3.0 },   // Becketts & Chapel into Hangar Straight
      { pct: 0.88, z: +2.0 },   // Stowe braking rise
      { pct: 0.95, z: -3.5 },   // Vale downhill into Club
      { pct: 1.00, z: 0.0 },    // Return to start line
    ]
  },
  monza: {
    baseAlt: 162,
    keyframes: [
      { pct: 0.00, z: 0.0 },    // Rettifilo Tribune
      { pct: 0.15, z: -1.5 },   // Prima Variante
      { pct: 0.28, z: -6.0 },   // Curva Grande descent
      { pct: 0.38, z: -8.5 },   // Variante della Roggia (lowest valley)
      { pct: 0.48, z: +1.0 },   // Curva di Lesmo 1 rise
      { pct: 0.56, z: +3.5 },   // Curva di Lesmo 2
      { pct: 0.68, z: -4.0 },   // Curva del Serraglio under banking bridge
      { pct: 0.78, z: +1.0 },   // Variante Ascari chicane
      { pct: 0.90, z: +3.0 },   // Back straight to Curva Parabolica (Alboreto)
      { pct: 1.00, z: 0.0 },    // Return to start line
    ]
  }
};

function interpolateElevation(pct, keyframes) {
  let p1 = keyframes[0];
  let p2 = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (pct >= keyframes[i].pct && pct <= keyframes[i + 1].pct) {
      p1 = keyframes[i];
      p2 = keyframes[i + 1];
      break;
    }
  }

  const range = p2.pct - p1.pct;
  const t = range > 0 ? (pct - p1.pct) / range : 0;
  // Smooth cosine s-curve interpolation
  const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
  return p1.z + (p2.z - p1.z) * smoothT;
}

for (const [id, config] of Object.entries(LEGACY_ELEVATIONS)) {
  const srcP = path.join(srcDir, `${id}.json`);
  const pubP = path.join(pubDir, `${id}.json`);

  if (!fs.existsSync(srcP)) continue;

  const data = JSON.parse(fs.readFileSync(srcP, 'utf8'));
  const telem = data.telemetry;
  const totalDist = data.lapLengthM;
  const numPts = telem.distance.length;

  const newZ = [];
  for (let i = 0; i < numPts; i++) {
    const s = telem.distance[i];
    const pct = Math.min(1.0, Math.max(0.0, s / totalDist));
    const zOffset = interpolateElevation(pct, config.keyframes);
    newZ.push(Number((config.baseAlt + zOffset).toFixed(2)));
  }

  data.telemetry.z = newZ;
  data.altitudeM = config.baseAlt;

  fs.writeFileSync(srcP, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(pubP, JSON.stringify(data, null, 2), 'utf8');

  const minZ = Math.min(...newZ);
  const maxZ = Math.max(...newZ);
  console.log(`✓ Enhanced elevation for ${data.name} (${id}): Base ${config.baseAlt}m, Min: ${minZ.toFixed(1)}m, Max: ${maxZ.toFixed(1)}m, Delta: ${(maxZ - minZ).toFixed(1)}m`);
}

console.log('\nAll 4 legacy track elevations enhanced with authentic terrain gradients!');
