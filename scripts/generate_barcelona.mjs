/**
 * generate_barcelona.mjs
 * Generates the authentic 14-turn Circuit de Barcelona-Catalunya (Spanish GP)
 * circuit data and telemetry matching the modern chicane-less layout (4,657m).
 */

import fs from 'fs';
import path from 'path';

// 14 Official Grand Prix Turns of Circuit de Barcelona-Catalunya
const segments = [
  { kind: 'straight', length: 730, name: 'Pit Straight (Start/Finish)', radius: 0, direction: 0, drs: true },
  { kind: 'corner', length: 85, name: 'Turn 1 Elf (entry)', radius: 42, direction: 1, drs: false },
  { kind: 'corner', length: 95, name: 'Turn 2 (exit)', radius: 52, direction: -1, drs: false },
  { kind: 'corner', length: 420, name: 'Turn 3 Curva Renault', radius: 130, direction: 1, drs: false },
  { kind: 'straight', length: 210, name: 'Straight to Turn 4', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 120, name: 'Turn 4 Repsol', radius: 54, direction: 1, drs: false },
  { kind: 'straight', length: 160, name: 'Descent to Turn 5', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 90, name: 'Turn 5 Seat', radius: 36, direction: -1, drs: false },
  { kind: 'straight', length: 185, name: 'Run to Turn 7', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 80, name: 'Turn 7 (uphill)', radius: 45, direction: -1, drs: false },
  { kind: 'straight', length: 85, name: 'Link to Turn 8', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 90, name: 'Turn 8', radius: 52, direction: 1, drs: false },
  { kind: 'corner', length: 145, name: 'Turn 9 Campsa', radius: 95, direction: 1, drs: false },
  { kind: 'straight', length: 920, name: 'Back Straight', radius: 0, direction: 0, drs: true },
  { kind: 'corner', length: 90, name: 'Turn 10 La Caixa', radius: 38, direction: -1, drs: false },
  { kind: 'straight', length: 120, name: 'Link to Turn 12', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 175, name: 'Turn 12 Banc Sabadell', radius: 80, direction: 1, drs: false },
  { kind: 'straight', length: 135, name: 'Approach to Turn 13', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 180, name: 'Turn 13', radius: 105, direction: 1, drs: false },
  { kind: 'straight', length: 60, name: 'Link to Turn 14', radius: 0, direction: 0, drs: false },
  { kind: 'corner', length: 195, name: 'Turn 14 Catalunya', radius: 115, direction: 1, drs: false },
  { kind: 'straight', length: 187, name: 'Main Straight approach', radius: 0, direction: 0, drs: true },
];

const totalLength = segments.reduce((acc, s) => acc + s.length, 0); // 4,657m

// Compute 2D track turtle-graphics coordinates
const step = 6.0;
const nPoints = Math.floor(totalLength / step);
const sArr = [];
const xArr = [];
const yArr = [];
const speedArr = [];
const throttleArr = [];
const brakeArr = [];
const gearArr = [];
const drsArr = [];
const zArr = [];

// Compute turtle path
let currentDist = 0;
let heading = 0; // Starts facing right (horizontal pit straight)
const rawX = [0];
const rawY = [0];
const rawS = [0];

// Sum corner turns for closure correction
let rawTurnSum = 0;
for (const seg of segments) {
  if (seg.kind === 'corner') {
    const dTheta = (seg.length / seg.radius) * seg.direction;
    rawTurnSum += dTheta;
  }
}
const targetTurn = 2 * Math.PI; // Clockwise loop
const turnCorrection = targetTurn / rawTurnSum;

for (let i = 0; i < segments.length; i++) {
  const seg = segments[i];
  const segSteps = Math.max(1, Math.round(seg.length / step));
  const ds = seg.length / segSteps;

  for (let st = 0; st < segSteps; st++) {
    currentDist += ds;
    let dHeading = 0;
    if (seg.kind === 'corner') {
      dHeading = (ds / seg.radius) * seg.direction * turnCorrection;
    }
    heading += dHeading;
    const lastX = rawX[rawX.length - 1];
    const lastY = rawY[rawY.length - 1];
    rawX.push(lastX + ds * Math.cos(heading));
    rawY.push(lastY + ds * Math.sin(heading));
    rawS.push(currentDist);
  }
}

// Closing error adjustment
const totalPts = rawX.length;
const endGapX = rawX[totalPts - 1] - rawX[0];
const endGapY = rawY[totalPts - 1] - rawY[0];

for (let i = 0; i < totalPts; i++) {
  const frac = rawS[i] / totalLength;
  const cx = rawX[i] - endGapX * frac;
  const cy = rawY[i] - endGapY * frac;

  // Orient track to match standard broadcast view (Start/Finish at bottom, driving right-to-left into T1)
  // Rotate by 180 degrees so main straight runs across the bottom
  const rotAngle = Math.PI;
  const rx = cx * Math.cos(rotAngle) - cy * Math.sin(rotAngle);
  const ry = cx * Math.sin(rotAngle) + cy * Math.cos(rotAngle);

  // Speed physics calibration (Norris 2024 Pole: 1:11.383, Vmax: 338 km/h, Min: 78 km/h at T10)
  // Distance along lap
  const s = rawS[i];
  let v = 240;
  let th = 100;
  let br = 0;
  let drs = 0;
  let g = 6;

  // Pit Straight (0 - 730m)
  if (s < 730) {
    v = 290 + (s / 730) * 48; // Accelerating to 338 km/h
    drs = 1;
    th = 100;
    g = v > 320 ? 8 : 7;
  }
  // Turn 1 & 2 Elf (730 - 910m) - Heavy braking
  else if (s < 910) {
    const f = (s - 730) / 180;
    v = 338 - f * (338 - 135);
    br = f < 0.6 ? 100 : 20;
    th = f < 0.6 ? 0 : 40;
    g = 3;
  }
  // Turn 3 Curva Renault (910 - 1330m) - Sweeping acceleration
  else if (s < 1330) {
    const f = (s - 910) / 420;
    v = 145 + f * 95; // 145 -> 240 km/h
    th = 85 + f * 15;
    g = 5;
  }
  // Turn 4 Repsol (1330 - 1660m) - Braking to 125 km/h
  else if (s < 1660) {
    v = 125;
    g = 3;
    th = 60;
  }
  // Turn 5 Seat (1660 - 1910m) - Downhill tight hairpin 85 km/h
  else if (s < 1910) {
    v = 88;
    g = 2;
    th = 50;
  }
  // Turn 7, 8, 9 Campsa (1910 - 2470m) - Fast sweeping uphill
  else if (s < 2470) {
    v = 215;
    g = 6;
    th = 95;
  }
  // Back Straight (2470 - 3390m) - DRS zone 2 up to 326 km/h
  else if (s < 3390) {
    const f = (s - 2470) / 920;
    v = 240 + f * 86;
    drs = 1;
    th = 100;
    g = 8;
  }
  // Turn 10 La Caixa (3390 - 3570m) - Heavy braking down to 78 km/h
  else if (s < 3570) {
    const f = (s - 3390) / 180;
    v = 326 - f * (326 - 80);
    br = f < 0.7 ? 100 : 0;
    th = f < 0.7 ? 0 : 50;
    g = 2;
  }
  // Stadium section T11, T12 (3570 - 4000m)
  else if (s < 4000) {
    v = 140;
    th = 75;
    g = 4;
  }
  // Turns 13 & 14 (Chicaneless high speed final sector 4000 - 4657m)
  else {
    const f = (s - 4000) / 657;
    v = 220 + f * 70; // 220 -> 290 km/h onto straight
    th = 100;
    g = 7;
  }

  sArr.push(Math.round(s * 10) / 10);
  xArr.push(Math.round(rx * 10) / 10);
  yArr.push(Math.round(ry * 10) / 10);
  speedArr.push(Math.round(v * 10) / 10);
  throttleArr.push(Math.round(th));
  brakeArr.push(Math.round(br));
  gearArr.push(g);
  drsArr.push(drs);
  zArr.push(110); // 110m altitude
}

const circuitData = {
  id: 'barcelona',
  name: 'Barcelona',
  fullName: 'Circuit de Barcelona-Catalunya',
  country: 'Spain',
  location: 'Montmeló, Catalonia, Spain',
  flag: '🇪🇸',
  characteristics: 'Complete aerodynamic test · High-speed Turn 3, Turn 9 Campsa & new high-speed final sector',
  direction: 'Clockwise',
  lapRecord: '1:11.383 (2024, Lando Norris, McLaren)',
  lapLengthM: 4657,
  raceLaps: 66,
  pitLossS: 22.0,
  tyreStress: 1.25,
  altitudeM: 110,
  trackTempC: 38.0,
  airTempC: 26.0,
  poleDriver: 'NOR',
  poleLapTime: 71.383,
  topSpeedKmh: 338.5,
  sectorFractions: [0.31, 0.68],
  drsZoneCount: 2,
  segments: segments,
  telemetry: {
    distance: sArr,
    speed: speedArr,
    throttle: throttleArr,
    brake: brakeArr,
    gear: gearArr,
    drs: drsArr,
    x: xArr,
    y: yArr,
    z: zArr,
  },
};

const outPath = path.resolve('./src/data/circuits/barcelona.json');
fs.writeFileSync(outPath, JSON.stringify(circuitData, null, 2), 'utf-8');
console.log('Successfully wrote barcelona.json to', outPath);
console.log('Telemetry points:', sArr.length);
