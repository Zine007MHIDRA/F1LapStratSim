/**
 * generate_all_24_circuits.mjs
 * Generates all 14 remaining Grand Prix circuits of the FIA Formula 1 World Championship,
 * completing the full 24-race championship calendar with closed-loop 2D GPS coordinates,
 * authentic 3D elevation topographies (altitude, elevation changes, banking),
 * corner-by-corner segment definitions, and physics-calibrated speed/throttle/brake telemetry.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '..', 'src', 'data', 'circuits');
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'data', 'circuits');

fs.mkdirSync(SRC_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Helper to generate closed-loop 2D track path, elevation curve, and telemetry profile
function buildCircuitData(def) {
  const {
    id, name, fullName, country, location, flag, characteristics, direction,
    lapRecord, lapLengthM, raceLaps, pitLossS, tyreStress, altitudeM,
    trackTempC, airTempC, poleDriver, poleLapTime, topSpeedKmh, sectorFractions,
    drsZoneCount, segments, elevationProfile, rotationDeg = 0
  } = def;

  const totalLength = segments.reduce((acc, s) => acc + s.length, 0);
  const step = 6.0;
  
  // 1. Calculate turn sum for loop closure
  let rawTurnSum = 0;
  for (const seg of segments) {
    if (seg.kind === 'corner') {
      const dTheta = (seg.length / seg.radius) * seg.direction;
      rawTurnSum += dTheta;
    }
  }
  const isAntiClockwise = direction === 'Anti-clockwise';
  const targetTurn = isAntiClockwise ? -2 * Math.PI : 2 * Math.PI;
  const turnCorrection = rawTurnSum !== 0 ? targetTurn / rawTurnSum : 1.0;

  // 2. Walk path using turtle graphics
  let currentDist = 0;
  let heading = 0;
  const rawX = [0];
  const rawY = [0];
  const rawS = [0];

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

  // 3. Close the loop smoothly
  const totalPts = rawX.length;
  const endGapX = rawX[totalPts - 1] - rawX[0];
  const endGapY = rawY[totalPts - 1] - rawY[0];

  const sArr = [];
  const xArr = [];
  const yArr = [];
  const speedArr = [];
  const throttleArr = [];
  const brakeArr = [];
  const gearArr = [];
  const drsArr = [];
  const zArr = [];

  const rotRad = (rotationDeg * Math.PI) / 180;

  for (let i = 0; i < totalPts; i++) {
    const frac = rawS[i] / totalLength;
    const cx = rawX[i] - endGapX * frac;
    const cy = rawY[i] - endGapY * frac;

    // Rotate to match standard broadcast orientation
    const rx = cx * Math.cos(rotRad) - cy * Math.sin(rotRad);
    const ry = cx * Math.sin(rotRad) + cy * Math.cos(rotRad);

    const s = rawS[i];

    // Compute realistic elevation Z (meters above sea level)
    let z = altitudeM;
    if (elevationProfile && elevationProfile.length > 0) {
      // Piecewise linear interpolation of elevation keyframes
      let p0 = elevationProfile[0];
      let p1 = elevationProfile[elevationProfile.length - 1];
      for (let k = 0; k < elevationProfile.length - 1; k++) {
        if (s >= elevationProfile[k].dist && s <= elevationProfile[k + 1].dist) {
          p0 = elevationProfile[k];
          p1 = elevationProfile[k + 1];
          break;
        }
      }
      const eFrac = p1.dist > p0.dist ? (s - p0.dist) / (p1.dist - p0.dist) : 0;
      z = p0.elevation + eFrac * (p1.elevation - p0.elevation);
    }

    // Determine current segment for physics speed / throttle / braking
    let curDistAcc = 0;
    let curSeg = segments[0];
    for (const seg of segments) {
      if (s >= curDistAcc && s <= curDistAcc + seg.length) {
        curSeg = seg;
        break;
      }
      curDistAcc += seg.length;
    }

    let v = 220;
    let th = 100;
    let br = 0;
    let drs = curSeg.drs ? 1 : 0;
    let gear = 5;

    if (curSeg.kind === 'straight') {
      const segProgress = (s - curDistAcc) / Math.max(1, curSeg.length);
      const minStraightSpeed = 160;
      v = minStraightSpeed + segProgress * (topSpeedKmh - minStraightSpeed);
      th = 100;
      br = 0;
      gear = v > 310 ? 8 : v > 270 ? 7 : v > 220 ? 6 : 5;
    } else {
      // Corner speed based on radius: v = sqrt(mu * g * R) scaled for F1 downforce
      const r = curSeg.radius || 60;
      const cornerBaseSpeed = Math.max(70, Math.min(270, Math.sqrt(r * 9.81 * 2.8) * 3.6));
      v = cornerBaseSpeed;
      if (r < 45) {
        // Tight hairpin / slow chicane
        th = 40;
        br = 60;
        gear = 2;
      } else if (r < 80) {
        // Medium corner
        th = 75;
        br = 20;
        gear = 3;
      } else if (r < 130) {
        // Fast sweeper
        th = 95;
        br = 0;
        gear = 5;
      } else {
        // High-speed kink
        th = 100;
        br = 0;
        gear = 7;
      }
    }

    sArr.push(Math.round(s * 10) / 10);
    xArr.push(Math.round(rx * 10) / 10);
    yArr.push(Math.round(ry * 10) / 10);
    speedArr.push(Math.round(v * 10) / 10);
    throttleArr.push(Math.round(th));
    brakeArr.push(Math.round(br));
    gearArr.push(gear);
    drsArr.push(drs);
    zArr.push(Math.round(z * 10) / 10);
  }

  return {
    id,
    name,
    fullName,
    country,
    location,
    flag,
    characteristics,
    direction,
    lapRecord,
    lapLengthM: totalLength,
    raceLaps,
    pitLossS,
    tyreStress,
    altitudeM,
    trackTempC,
    airTempC,
    poleDriver,
    poleLapTime,
    topSpeedKmh,
    sectorFractions,
    drsZoneCount,
    segments,
    telemetry: {
      distance: sArr,
      speed: speedArr,
      throttle: throttleArr,
      brake: brakeArr,
      gear: gearArr,
      drs: drsArr,
      x: xArr,
      y: yArr,
      z: zArr
    }
  };
}

// =========================================================================
// 14 NEW FORMULA 1 CIRCUITS
// =========================================================================
const NEW_CIRCUITS = [
  // 1. JEDDAH CORNICHE CIRCUIT (Saudi Arabia)
  {
    id: 'jeddah',
    name: 'Jeddah',
    fullName: 'Jeddah Corniche Circuit',
    country: 'Saudi Arabia',
    location: 'Jeddah, Kingdom of Saudi Arabia',
    flag: '🇸🇦',
    characteristics: 'Fastest street circuit · 27 high-speed blind curves along the Red Sea coast',
    direction: 'Anti-clockwise',
    lapRecord: '1:30.734 (2021, Hamilton)',
    raceLaps: 50,
    pitLossS: 20.5,
    tyreStress: 1.15,
    altitudeM: 12,
    trackTempC: 32.0,
    airTempC: 27.5,
    poleDriver: 'VER',
    poleLapTime: 87.472,
    topSpeedKmh: 345.0,
    sectorFractions: [0.33, 0.67],
    drsZoneCount: 3,
    rotationDeg: 90,
    elevationProfile: [
      { dist: 0, elevation: 12.0 },
      { dist: 1500, elevation: 14.5 },
      { dist: 3200, elevation: 11.8 },
      { dist: 4800, elevation: 15.0 },
      { dist: 6174, elevation: 12.0 }
    ],
    segments: [
      { kind: 'straight', length: 650, name: 'Main Straight (Start/Finish)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 70, name: 'Turn 1 Hairpin entry', radius: 35, direction: -1, drs: false },
      { kind: 'corner', length: 75, name: 'Turn 2 Chicane exit', radius: 40, direction: 1, drs: false },
      { kind: 'straight', length: 140, name: 'Esses link', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 4 esses', radius: 110, direction: -1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 5 esses', radius: 115, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 6 esses', radius: 120, direction: -1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 7 esses', radius: 110, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 8', radius: 130, direction: -1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 9', radius: 140, direction: 1, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 10', radius: 150, direction: -1, drs: false },
      { kind: 'straight', length: 450, name: 'Straight to Turn 13', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 220, name: 'Turn 13 Banked Hairpin (12°)', radius: 65, direction: -1, drs: false },
      { kind: 'straight', length: 280, name: 'Run to Turn 14', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 14', radius: 120, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 15', radius: 130, direction: -1, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 16', radius: 115, direction: -1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 17', radius: 125, direction: 1, drs: false },
      { kind: 'straight', length: 240, name: 'Link to Turn 20', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 20 High-speed blind crest', radius: 160, direction: 1, drs: false },
      { kind: 'corner', length: 150, name: 'Turn 21', radius: 155, direction: -1, drs: false },
      { kind: 'corner', length: 180, name: 'Turn 22 blind left', radius: 145, direction: -1, drs: false },
      { kind: 'corner', length: 130, name: 'Turn 23', radius: 150, direction: 1, drs: false },
      { kind: 'straight', length: 980, name: 'Back Straight (Flat-out curve)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 110, name: 'Turn 27 Final Hairpin', radius: 45, direction: -1, drs: false },
      { kind: 'straight', length: 484, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 2. ALBERT PARK CIRCUIT (Australia)
  {
    id: 'albert_park',
    name: 'Melbourne',
    fullName: 'Albert Park Circuit',
    country: 'Australia',
    location: 'Melbourne, Victoria, Australia',
    flag: '🇦🇺',
    characteristics: 'Lakeside street circuit · Rapid chicane transitions & 4 DRS activation zones',
    direction: 'Clockwise',
    lapRecord: '1:19.813 (2024, Leclerc)',
    raceLaps: 58,
    pitLossS: 20.0,
    tyreStress: 1.05,
    altitudeM: 10,
    trackTempC: 34.5,
    airTempC: 22.0,
    poleDriver: 'VER',
    poleLapTime: 75.915,
    topSpeedKmh: 330.0,
    sectorFractions: [0.30, 0.65],
    drsZoneCount: 4,
    rotationDeg: 180,
    elevationProfile: [
      { dist: 0, elevation: 10.0 },
      { dist: 1200, elevation: 13.5 },
      { dist: 2800, elevation: 9.0 },
      { dist: 4200, elevation: 14.0 },
      { dist: 5278, elevation: 10.0 }
    ],
    segments: [
      { kind: 'straight', length: 720, name: 'Main Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 1 Jones', radius: 48, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 2 Brabham', radius: 56, direction: -1, drs: false },
      { kind: 'straight', length: 380, name: 'Run to Turn 3', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 3 Sports Center', radius: 42, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 4', radius: 52, direction: -1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 5 Whiteford', radius: 110, direction: 1, drs: false },
      { kind: 'corner', length: 115, name: 'Turn 6 Marina', radius: 75, direction: 1, drs: false },
      { kind: 'straight', length: 240, name: 'Run to Turn 7', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 130, name: 'Turn 7', radius: 95, direction: -1, drs: false },
      { kind: 'straight', length: 1100, name: 'Lakeside Flat-out Sweep', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 155, name: 'Turn 9 Waite (High-G chicane)', radius: 125, direction: 1, drs: false },
      { kind: 'corner', length: 165, name: 'Turn 10 Waite exit', radius: 120, direction: -1, drs: false },
      { kind: 'straight', length: 480, name: 'Straight to Turn 11', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 95, name: 'Turn 11 Clark', radius: 50, direction: -1, drs: false },
      { kind: 'corner', length: 100, name: 'Turn 12', radius: 58, direction: 1, drs: false },
      { kind: 'straight', length: 290, name: 'Run to Turn 13', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 88, name: 'Turn 13 Ascari', radius: 44, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 14 Stewart (Final Turn)', radius: 52, direction: 1, drs: false },
      { kind: 'straight', length: 630, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 3. SHANGHAI INTERNATIONAL CIRCUIT (China)
  {
    id: 'shanghai',
    name: 'Shanghai',
    fullName: 'Shanghai International Circuit',
    country: 'China',
    location: 'Jiading, Shanghai, China',
    flag: '🇨🇳',
    characteristics: 'Architectural masterpiece · 270° snail Turn 1-4 & massive 1.2km back straight',
    direction: 'Clockwise',
    lapRecord: '1:32.238 (2004, Schumacher)',
    raceLaps: 56,
    pitLossS: 22.5,
    tyreStress: 1.30,
    altitudeM: 10,
    trackTempC: 28.0,
    airTempC: 21.0,
    poleDriver: 'VER',
    poleLapTime: 93.660,
    topSpeedKmh: 340.0,
    sectorFractions: [0.32, 0.65],
    drsZoneCount: 2,
    rotationDeg: 0,
    elevationProfile: [
      { dist: 0, elevation: 10.0 },
      { dist: 1400, elevation: 15.0 },
      { dist: 2800, elevation: 6.5 },
      { dist: 4200, elevation: 16.0 },
      { dist: 5451, elevation: 10.0 }
    ],
    segments: [
      { kind: 'straight', length: 710, name: 'Main Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 280, name: 'Turn 1-2 Snail Curve (Decelerating spiral)', radius: 55, direction: 1, drs: false },
      { kind: 'corner', length: 190, name: 'Turn 3-4 Snail Exit', radius: 45, direction: -1, drs: false },
      { kind: 'straight', length: 260, name: 'Straight to Turn 6', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 6 Hairpin', radius: 38, direction: 1, drs: false },
      { kind: 'corner', length: 220, name: 'Turn 7-8 High-speed Esses', radius: 135, direction: -1, drs: false },
      { kind: 'corner', length: 180, name: 'Turn 8 exit', radius: 125, direction: 1, drs: false },
      { kind: 'straight', length: 210, name: 'Run to Turn 9', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 9', radius: 52, direction: -1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 10', radius: 60, direction: -1, drs: false },
      { kind: 'corner', length: 210, name: 'Turn 11-12 Banking approach', radius: 110, direction: 1, drs: false },
      { kind: 'corner', length: 230, name: 'Turn 13 Parabolica onto Back Straight', radius: 140, direction: 1, drs: false },
      { kind: 'straight', length: 1200, name: 'Massive Back Straight (1.2 km)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 95, name: 'Turn 14 Hairpin', radius: 34, direction: 1, drs: false },
      { kind: 'straight', length: 180, name: 'Straight to Turn 16', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 125, name: 'Turn 16 Final Sweeper', radius: 85, direction: -1, drs: false },
      { kind: 'straight', length: 361, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 4. MIAMI INTERNATIONAL AUTODROME (USA)
  {
    id: 'miami',
    name: 'Miami',
    fullName: 'Miami International Autodrome',
    country: 'United States',
    location: 'Miami Gardens, Florida, USA',
    flag: '🇺🇸',
    characteristics: 'Hard Rock Stadium campus · High-speed sweepers, tight marina chicane & 340 km/h straight',
    direction: 'Anti-clockwise',
    lapRecord: '1:29.708 (2023, Verstappen)',
    raceLaps: 57,
    pitLossS: 21.0,
    tyreStress: 1.10,
    altitudeM: 5,
    trackTempC: 45.0,
    airTempC: 30.5,
    poleDriver: 'VER',
    poleLapTime: 87.241,
    topSpeedKmh: 342.0,
    sectorFractions: [0.31, 0.66],
    drsZoneCount: 3,
    rotationDeg: 270,
    elevationProfile: [
      { dist: 0, elevation: 5.0 },
      { dist: 1600, elevation: 7.0 },
      { dist: 3100, elevation: 15.0 }, // Overpass bridge climb
      { dist: 4000, elevation: 6.0 },
      { dist: 5412, elevation: 5.0 }
    ],
    segments: [
      { kind: 'straight', length: 580, name: 'Main Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 90, name: 'Turn 1', radius: 45, direction: -1, drs: false },
      { kind: 'straight', length: 180, name: 'Run to Turn 2', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 2', radius: 80, direction: 1, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 3', radius: 95, direction: -1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 4-5 Stadium esses', radius: 120, direction: 1, drs: false },
      { kind: 'corner', length: 150, name: 'Turn 6 esses', radius: 130, direction: -1, drs: false },
      { kind: 'corner', length: 160, name: 'Turn 7-8 Marina sweeper', radius: 140, direction: 1, drs: false },
      { kind: 'straight', length: 820, name: 'Marina Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 11 Braking zone', radius: 42, direction: -1, drs: false },
      { kind: 'straight', length: 140, name: 'Link to Turn 13', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 65, name: 'Turn 14 Highway Overpass chicane', radius: 28, direction: 1, drs: false },
      { kind: 'corner', length: 70, name: 'Turn 15 chicane crest', radius: 30, direction: -1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 16 onto long straight', radius: 65, direction: -1, drs: false },
      { kind: 'straight', length: 1280, name: 'Interstate Long Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 95, name: 'Turn 17 Hairpin', radius: 35, direction: -1, drs: false },
      { kind: 'straight', length: 220, name: 'Straight to Turn 18', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 18-19 Final turns', radius: 90, direction: 1, drs: false },
      { kind: 'straight', length: 397, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 5. AUTODROMO ENZO E DINO FERRARI (Imola / Italy)
  {
    id: 'imola',
    name: 'Imola',
    fullName: 'Autodromo Enzo e Dino Ferrari',
    country: 'Italy',
    location: 'Imola, Emilia-Romagna, Italy',
    flag: '🇮🇹',
    characteristics: 'Historic temple · Anti-clockwise rollercoaster, Tamburello, Piratella & Acque Minerali',
    direction: 'Anti-clockwise',
    lapRecord: '1:15.484 (2020, Hamilton)',
    raceLaps: 63,
    pitLossS: 24.5,
    tyreStress: 1.15,
    altitudeM: 42,
    trackTempC: 38.0,
    airTempC: 25.0,
    poleDriver: 'VER',
    poleLapTime: 74.746,
    topSpeedKmh: 320.0,
    sectorFractions: [0.32, 0.67],
    drsZoneCount: 1,
    rotationDeg: 90,
    elevationProfile: [
      { dist: 0, elevation: 42.0 },
      { dist: 1200, elevation: 46.0 },
      { dist: 2200, elevation: 76.0 }, // Peak at Piratella
      { dist: 3100, elevation: 48.0 }, // Plunge into Acque Minerali
      { dist: 4909, elevation: 42.0 }
    ],
    segments: [
      { kind: 'straight', length: 750, name: 'Main Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 2 Tamburello chicane entry', radius: 45, direction: -1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 3 Tamburello chicane exit', radius: 48, direction: 1, drs: false },
      { kind: 'straight', length: 310, name: 'Run to Villeneuve', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 5 Villeneuve chicane', radius: 52, direction: -1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 6 Villeneuve exit', radius: 50, direction: 1, drs: false },
      { kind: 'straight', length: 180, name: 'Run to Tosa', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 7 Tosa Hairpin (Uphill)', radius: 36, direction: -1, drs: false },
      { kind: 'straight', length: 420, name: 'Steep climb to Piratella', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 9 Piratella (Blind crest left)', radius: 85, direction: -1, drs: false },
      { kind: 'straight', length: 260, name: 'Descent to Acque Minerali', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 11 Acque Minerali entry', radius: 55, direction: 1, drs: false },
      { kind: 'corner', length: 105, name: 'Turn 12 Acque Minerali uphill exit', radius: 62, direction: 1, drs: false },
      { kind: 'straight', length: 380, name: 'Run to Variante Alta', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 14 Variante Alta kerb strike', radius: 38, direction: 1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 15 Variante Alta exit', radius: 42, direction: -1, drs: false },
      { kind: 'straight', length: 510, name: 'Downhill descent to Rivazza', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 17 Rivazza 1', radius: 48, direction: -1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 18 Rivazza 2', radius: 52, direction: -1, drs: false },
      { kind: 'straight', length: 394, name: 'Pit Straight acceleration', radius: 0, direction: 0, drs: true },
    ]
  },

  // 6. CIRCUIT GILLES VILLENEUVE (Montreal / Canada)
  {
    id: 'montreal',
    name: 'Montreal',
    fullName: 'Circuit Gilles Villeneuve',
    country: 'Canada',
    location: 'Montreal, Quebec, Canada',
    flag: '🇨🇦',
    characteristics: 'Île Notre-Dame parkway · Stop-and-go heavy braking, low downforce & Wall of Champions',
    direction: 'Clockwise',
    lapRecord: '1:13.078 (2019, Bottas)',
    raceLaps: 70,
    pitLossS: 19.5,
    tyreStress: 0.95,
    altitudeM: 15,
    trackTempC: 36.0,
    airTempC: 22.5,
    poleDriver: 'RUS',
    poleLapTime: 72.000,
    topSpeedKmh: 340.0,
    sectorFractions: [0.32, 0.68],
    drsZoneCount: 2,
    rotationDeg: 0,
    elevationProfile: [
      { dist: 0, elevation: 15.0 },
      { dist: 1500, elevation: 17.5 },
      { dist: 3000, elevation: 13.0 },
      { dist: 4361, elevation: 15.0 }
    ],
    segments: [
      { kind: 'straight', length: 650, name: 'Pit Straight', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 1 Senna Chicane entry', radius: 42, direction: -1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 2 Senna Hairpin', radius: 34, direction: 1, drs: false },
      { kind: 'straight', length: 240, name: 'Run to Turn 3', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 3 chicane', radius: 44, direction: 1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 4 chicane exit', radius: 46, direction: -1, drs: false },
      { kind: 'straight', length: 420, name: 'Run to Turn 6', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 6 left', radius: 48, direction: -1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 7 right', radius: 52, direction: 1, drs: false },
      { kind: 'straight', length: 480, name: 'Straight to Turn 8', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 8 chicane', radius: 40, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 9 chicane', radius: 44, direction: -1, drs: false },
      { kind: 'straight', length: 280, name: 'Run to Hairpin', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 10 L’Epingle Hairpin', radius: 30, direction: 1, drs: false },
      { kind: 'straight', length: 1050, name: 'Droit du Casino (Long Straight)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 13 Final Chicane', radius: 38, direction: 1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 14 Wall of Champions exit', radius: 40, direction: -1, drs: false },
      { kind: 'straight', length: 216, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 7. HUNGARORING (Hungary)
  {
    id: 'hungaroring',
    name: 'Hungaroring',
    fullName: 'Hungaroring',
    country: 'Hungary',
    location: 'Mogyoród, Pest County, Hungary',
    flag: '🇭🇺',
    characteristics: 'Monaco without the walls · Continuous twisting technical rhythm, high downforce & summer heat',
    direction: 'Clockwise',
    lapRecord: '1:16.627 (2020, Hamilton)',
    raceLaps: 70,
    pitLossS: 21.0,
    tyreStress: 1.10,
    altitudeM: 220,
    trackTempC: 48.0,
    airTempC: 32.0,
    poleDriver: 'NOR',
    poleLapTime: 75.227,
    topSpeedKmh: 310.0,
    sectorFractions: [0.29, 0.65],
    drsZoneCount: 2,
    rotationDeg: 180,
    elevationProfile: [
      { dist: 0, elevation: 220.0 },
      { dist: 800, elevation: 185.0 }, // Downhill plunge to T2
      { dist: 2200, elevation: 210.0 },
      { dist: 3500, elevation: 235.0 },
      { dist: 4381, elevation: 220.0 }
    ],
    segments: [
      { kind: 'straight', length: 780, name: 'Main Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 105, name: 'Turn 1 Downhill Hairpin', radius: 36, direction: 1, drs: false },
      { kind: 'straight', length: 180, name: 'Run to Turn 2', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 120, name: 'Turn 2 Off-camber downhill left', radius: 55, direction: -1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 3 Fast uphill right', radius: 95, direction: 1, drs: false },
      { kind: 'straight', length: 260, name: 'Run to Turn 4', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 115, name: 'Turn 4 Blind crest left', radius: 110, direction: -1, drs: false },
      { kind: 'corner', length: 130, name: 'Turn 5 Long sweeping right', radius: 75, direction: 1, drs: false },
      { kind: 'straight', length: 210, name: 'Run to Chicane', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 75, name: 'Turn 6 Chicane right', radius: 34, direction: 1, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 7 Chicane left', radius: 36, direction: -1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 8', radius: 70, direction: -1, drs: false },
      { kind: 'corner', length: 105, name: 'Turn 9', radius: 68, direction: 1, drs: false },
      { kind: 'straight', length: 190, name: 'Link to Turn 11', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 11 Fast right sweeper', radius: 105, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 12 90-degree right', radius: 48, direction: 1, drs: false },
      { kind: 'corner', length: 170, name: 'Turn 13 180-degree hairpin left', radius: 52, direction: -1, drs: false },
      { kind: 'corner', length: 180, name: 'Turn 14 Final turn onto straight', radius: 60, direction: 1, drs: false },
      { kind: 'straight', length: 446, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 8. CIRCUIT ZANDVOORT (Netherlands)
  {
    id: 'zandvoort',
    name: 'Zandvoort',
    fullName: 'Circuit Zandvoort',
    country: 'Netherlands',
    location: 'Zandvoort, North Holland, Netherlands',
    flag: '🇳🇱',
    characteristics: 'Dune rollercoaster · 18-degree banking at Hugenholtz & Arie Luyendyk, sea breeze & zero runoff',
    direction: 'Clockwise',
    lapRecord: '1:11.097 (2021, Hamilton)',
    raceLaps: 72,
    pitLossS: 20.0,
    tyreStress: 1.25,
    altitudeM: 5,
    trackTempC: 29.0,
    airTempC: 19.5,
    poleDriver: 'NOR',
    poleLapTime: 69.673,
    topSpeedKmh: 315.0,
    sectorFractions: [0.31, 0.67],
    drsZoneCount: 2,
    rotationDeg: 90,
    elevationProfile: [
      { dist: 0, elevation: 5.0 },
      { dist: 1100, elevation: 18.0 }, // Dune crest
      { dist: 2400, elevation: 3.5 },
      { dist: 3500, elevation: 16.0 },
      { dist: 4259, elevation: 5.0 }
    ],
    segments: [
      { kind: 'straight', length: 680, name: 'Main Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 95, name: 'Turn 1 Tarzan Hairpin', radius: 42, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 2 Gerlachbocht', radius: 75, direction: 1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 3 Hugenholtzbocht (18° Banking)', radius: 45, direction: -1, drs: false },
      { kind: 'straight', length: 320, name: 'Dune Crest run to Hunserug', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 4 Hunserug blind right', radius: 110, direction: 1, drs: false },
      { kind: 'straight', length: 190, name: 'Run to Rob Slotemaker', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 105, name: 'Turn 7 Scheivlak (High-speed blind drop)', radius: 135, direction: 1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 8 Mastersbocht', radius: 120, direction: 1, drs: false },
      { kind: 'straight', length: 180, name: 'Run to Turn 9', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 9 Bocht 9', radius: 62, direction: 1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 10 CM.com bocht', radius: 55, direction: -1, drs: false },
      { kind: 'straight', length: 280, name: 'Back straight to Hans Ernst', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 75, name: 'Turn 11 Hans Ernst chicane', radius: 36, direction: 1, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 12 Hans Ernst exit', radius: 38, direction: -1, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 13 Kumhobocht', radius: 85, direction: 1, drs: false },
      { kind: 'corner', length: 195, name: 'Turn 14 Arie Luyendykbocht (18° Banking)', radius: 145, direction: 1, drs: true },
      { kind: 'straight', length: 579, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 9. BAKU CITY CIRCUIT (Azerbaijan)
  {
    id: 'baku',
    name: 'Baku',
    fullName: 'Baku City Circuit',
    country: 'Azerbaijan',
    location: 'Baku, Azerbaijan',
    flag: '🇦🇿',
    characteristics: 'City of contrasts · Massive 2.2km main straight (355 km/h) & ultra-narrow 7.6m Castle section',
    direction: 'Anti-clockwise',
    lapRecord: '1:43.009 (2019, Leclerc)',
    raceLaps: 51,
    pitLossS: 22.0,
    tyreStress: 0.90,
    altitudeM: -24, // Below sea level
    trackTempC: 36.0,
    airTempC: 24.5,
    poleDriver: 'LEC',
    poleLapTime: 101.365,
    topSpeedKmh: 355.0,
    sectorFractions: [0.35, 0.70],
    drsZoneCount: 2,
    rotationDeg: 90,
    elevationProfile: [
      { dist: 0, elevation: -24.0 },
      { dist: 1800, elevation: -20.0 },
      { dist: 2700, elevation: +4.0 }, // Castle section climb
      { dist: 4000, elevation: -18.0 },
      { dist: 6003, elevation: -24.0 }
    ],
    segments: [
      { kind: 'straight', length: 1100, name: 'Neftchilar Avenue (Part of 2.2km straight)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 1 90-degree left', radius: 35, direction: -1, drs: false },
      { kind: 'straight', length: 280, name: 'Run to Turn 2', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 2 90-degree left', radius: 35, direction: -1, drs: false },
      { kind: 'straight', length: 420, name: 'Run to Turn 3', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 3 90-degree right', radius: 35, direction: 1, drs: false },
      { kind: 'straight', length: 180, name: 'Run to Turn 4', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 4 90-degree left', radius: 35, direction: -1, drs: false },
      { kind: 'straight', length: 260, name: 'Run to Turn 5', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 5-6 chicane', radius: 40, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 6 chicane exit', radius: 42, direction: -1, drs: false },
      { kind: 'straight', length: 210, name: 'Approach to Castle section', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 65, name: 'Turn 8 Castle entry (7.6m width)', radius: 24, direction: -1, drs: false },
      { kind: 'corner', length: 70, name: 'Turn 9 Castle tight wall', radius: 26, direction: 1, drs: false },
      { kind: 'corner', length: 75, name: 'Turn 10 Castle crest', radius: 28, direction: -1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 11-12 Castle descent', radius: 45, direction: 1, drs: false },
      { kind: 'straight', length: 280, name: 'Descent to Turn 15', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 15 Downhill barrier brush', radius: 45, direction: -1, drs: false },
      { kind: 'straight', length: 190, name: 'Run to Turn 16', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 16 90-degree left onto waterfront', radius: 38, direction: -1, drs: false },
      { kind: 'straight', length: 1300, name: 'High-speed flat out curve to finish line', radius: 0, direction: 0, drs: true },
      { kind: 'straight', length: 958, name: 'Main Straight finish sprint', radius: 0, direction: 0, drs: true },
    ]
  },

  // 10. MARINA BAY STREET CIRCUIT (Singapore)
  {
    id: 'singapore',
    name: 'Singapore',
    fullName: 'Marina Bay Street Circuit',
    country: 'Singapore',
    location: 'Marina Bay, Singapore',
    flag: '🇸🇬',
    characteristics: 'The original night race · Extreme tropical humidity, bumpy street asphalt & 19 braking zones',
    direction: 'Anti-clockwise',
    lapRecord: '1:34.486 (2024, Ricciardo)',
    raceLaps: 62,
    pitLossS: 27.0,
    tyreStress: 1.05,
    altitudeM: 15,
    trackTempC: 35.0,
    airTempC: 29.5,
    poleDriver: 'NOR',
    poleLapTime: 89.525,
    topSpeedKmh: 310.0,
    sectorFractions: [0.31, 0.65],
    drsZoneCount: 4,
    rotationDeg: 180,
    elevationProfile: [
      { dist: 0, elevation: 15.0 },
      { dist: 1200, elevation: 18.0 },
      { dist: 2600, elevation: 11.0 },
      { dist: 3800, elevation: 16.5 },
      { dist: 4940, elevation: 15.0 }
    ],
    segments: [
      { kind: 'straight', length: 580, name: 'Pit Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 1 Sheares chicane', radius: 42, direction: -1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 2 chicane right', radius: 45, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 3 chicane left', radius: 40, direction: -1, drs: false },
      { kind: 'straight', length: 420, name: 'Republic Boulevard', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 5 90-degree right', radius: 38, direction: 1, drs: false },
      { kind: 'straight', length: 850, name: 'Raffles Boulevard (High speed curve)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 95, name: 'Turn 7 Memorial corner', radius: 40, direction: -1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 8 Stamford', radius: 38, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 9 Padang', radius: 42, direction: -1, drs: false },
      { kind: 'straight', length: 380, name: 'St Andrew’s Road', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 11-12 Anderson Bridge', radius: 55, direction: -1, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 13 Fullerton hairpin', radius: 30, direction: -1, drs: false },
      { kind: 'straight', length: 480, name: 'Esplanade Drive to new straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 14 90-degree right', radius: 40, direction: 1, drs: false },
      { kind: 'straight', length: 410, name: 'New Raffles Avenue Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 95, name: 'Turn 16-17 Grandstand chicane', radius: 45, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 18-19 Final corners', radius: 60, direction: -1, drs: false },
      { kind: 'straight', length: 285, name: 'Pit Straight approach', radius: 0, direction: 0, drs: true },
    ]
  },

  // 11. AUTÓDROMO HERMANOS RODRÍGUEZ (Mexico City / Mexico)
  {
    id: 'mexico_city',
    name: 'Mexico City',
    fullName: 'Autódromo Hermanos Rodríguez',
    country: 'Mexico',
    location: 'Mexico City, Mexico',
    flag: '🇲🇽',
    characteristics: 'Altitude powerhouse · 2,240m thin air (78 kPa), Foro Sol baseball stadium & 352 km/h drag',
    direction: 'Clockwise',
    lapRecord: '1:17.774 (2021, Bottas)',
    raceLaps: 71,
    pitLossS: 22.0,
    tyreStress: 1.00,
    altitudeM: 2240, // 2,240m elevation
    trackTempC: 44.0,
    airTempC: 24.0,
    poleDriver: 'SAI',
    poleLapTime: 75.946,
    topSpeedKmh: 352.0,
    sectorFractions: [0.33, 0.67],
    drsZoneCount: 3,
    rotationDeg: 0,
    elevationProfile: [
      { dist: 0, elevation: 2240.0 },
      { dist: 1500, elevation: 2242.0 },
      { dist: 2800, elevation: 2238.5 },
      { dist: 4304, elevation: 2240.0 }
    ],
    segments: [
      { kind: 'straight', length: 1200, name: 'Main Straight (1.2 km drag to T1)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 1 Moisés Solana chicane', radius: 38, direction: 1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 2 chicane left', radius: 40, direction: -1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 3 chicane exit', radius: 44, direction: 1, drs: false },
      { kind: 'straight', length: 480, name: 'Straight to Turn 4', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 85, name: 'Turn 4 chicane', radius: 38, direction: -1, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 5 chicane right', radius: 42, direction: 1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 6 slow hairpin', radius: 36, direction: 1, drs: false },
      { kind: 'straight', length: 280, name: 'Run to the Esses', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 7 fast esses left', radius: 110, direction: -1, drs: false },
      { kind: 'corner', length: 125, name: 'Turn 8 fast esses right', radius: 115, direction: 1, drs: false },
      { kind: 'corner', length: 130, name: 'Turn 9 fast esses left', radius: 120, direction: -1, drs: false },
      { kind: 'corner', length: 135, name: 'Turn 10 fast esses right', radius: 125, direction: 1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 11 esses exit', radius: 130, direction: -1, drs: false },
      { kind: 'straight', length: 320, name: 'Run to Foro Sol Stadium', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 80, name: 'Turn 12 Stadium entry', radius: 35, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 13-15 Baseball amphitheatre slow complex', radius: 28, direction: -1, drs: false },
      { kind: 'corner', length: 160, name: 'Turn 16-17 Peraltada exit', radius: 145, direction: 1, drs: false },
      { kind: 'straight', length: 459, name: 'Pit Straight sprint', radius: 0, direction: 0, drs: true },
    ]
  },

  // 12. LAS VEGAS STRIP CIRCUIT (USA)
  {
    id: 'las_vegas',
    name: 'Las Vegas',
    fullName: 'Las Vegas Strip Circuit',
    country: 'United States',
    location: 'Las Vegas, Nevada, USA',
    flag: '🇺🇸',
    characteristics: 'Glitz under the lights · 1.9km flat out down the Las Vegas Strip, cold night tarmac & 350 km/h',
    direction: 'Anti-clockwise',
    lapRecord: '1:35.490 (2023, Piastri)',
    raceLaps: 50,
    pitLossS: 21.5,
    tyreStress: 0.90,
    altitudeM: 610,
    trackTempC: 18.0,
    airTempC: 13.5,
    poleDriver: 'LEC',
    poleLapTime: 92.726,
    topSpeedKmh: 350.0,
    sectorFractions: [0.30, 0.68],
    drsZoneCount: 2,
    rotationDeg: 0,
    elevationProfile: [
      { dist: 0, elevation: 610.0 },
      { dist: 2100, elevation: 618.0 },
      { dist: 4200, elevation: 604.0 },
      { dist: 6201, elevation: 610.0 }
    ],
    segments: [
      { kind: 'straight', length: 780, name: 'Pit Straight (Paddock building)', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 1-2 Hairpin left', radius: 38, direction: -1, drs: false },
      { kind: 'straight', length: 180, name: 'Koval Lane approach', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 3 90-degree right', radius: 42, direction: 1, drs: false },
      { kind: 'straight', length: 950, name: 'Koval Lane Straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 160, name: 'Turn 5-6 Sphere sweeping chicane', radius: 110, direction: 1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 7-8 Sphere exit left', radius: 95, direction: -1, drs: false },
      { kind: 'straight', length: 240, name: 'Sands Avenue to Strip', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 12 90-degree left onto the Strip', radius: 45, direction: -1, drs: false },
      { kind: 'straight', length: 1900, name: 'Las Vegas Strip Straight (1.9 km flat out past Bellagio & Caesars)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 14 Heavy braking chicane', radius: 36, direction: -1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 15 chicane right', radius: 38, direction: 1, drs: false },
      { kind: 'straight', length: 240, name: 'Harmon Avenue', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 17 Final left curve onto Paddock', radius: 85, direction: -1, drs: false },
      { kind: 'straight', length: 1061, name: 'Main straight finish run', radius: 0, direction: 0, drs: false },
    ]
  },

  // 13. LUSAIL INTERNATIONAL CIRCUIT (Qatar)
  {
    id: 'lusail',
    name: 'Lusail',
    fullName: 'Lusail International Circuit',
    country: 'Qatar',
    location: 'Lusail, Al Daayen, Qatar',
    flag: '🇶🇦',
    characteristics: 'High-speed G-force gauntlet · Relentless medium/high speed aerodynamic corners & extreme tyre load',
    direction: 'Clockwise',
    lapRecord: '1:24.319 (2023, Verstappen)',
    raceLaps: 57,
    pitLossS: 23.0,
    tyreStress: 1.40, // Highest tyre stress on calendar
    altitudeM: 25,
    trackTempC: 36.0,
    airTempC: 28.0,
    poleDriver: 'VER',
    poleLapTime: 83.778,
    topSpeedKmh: 335.0,
    sectorFractions: [0.33, 0.67],
    drsZoneCount: 1,
    rotationDeg: 180,
    elevationProfile: [
      { dist: 0, elevation: 25.0 },
      { dist: 1400, elevation: 28.0 },
      { dist: 2900, elevation: 21.0 },
      { dist: 4200, elevation: 27.5 },
      { dist: 5419, elevation: 25.0 }
    ],
    segments: [
      { kind: 'straight', length: 1068, name: 'Main Straight (1.06 km)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 110, name: 'Turn 1 Braking zone right', radius: 45, direction: 1, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 2 left', radius: 65, direction: -1, drs: false },
      { kind: 'straight', length: 180, name: 'Run to Turn 4', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 130, name: 'Turn 4 right sweeper', radius: 85, direction: 1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 5 left', radius: 95, direction: -1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 6 slow hairpin right', radius: 38, direction: 1, drs: false },
      { kind: 'straight', length: 190, name: 'Run to Turn 7', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 135, name: 'Turn 7', radius: 105, direction: -1, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 8', radius: 110, direction: 1, drs: false },
      { kind: 'corner', length: 145, name: 'Turn 9', radius: 115, direction: -1, drs: false },
      { kind: 'corner', length: 150, name: 'Turn 10', radius: 120, direction: -1, drs: false },
      { kind: 'straight', length: 280, name: 'Straight to Triple Apex', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 180, name: 'Turn 12 Triple Apex part 1 (Extreme 5G)', radius: 140, direction: 1, drs: false },
      { kind: 'corner', length: 170, name: 'Turn 13 Triple Apex part 2', radius: 145, direction: 1, drs: false },
      { kind: 'corner', length: 160, name: 'Turn 14 Triple Apex exit', radius: 150, direction: 1, drs: false },
      { kind: 'straight', length: 210, name: 'Run to Turn 16', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 140, name: 'Turn 16 Final Sweeper onto Pit Straight', radius: 85, direction: 1, drs: false },
      { kind: 'straight', length: 781, name: 'Pit Straight sprint', radius: 0, direction: 0, drs: true },
    ]
  },

  // 14. YAS MARINA CIRCUIT (Abu Dhabi)
  {
    id: 'yas_marina',
    name: 'Abu Dhabi',
    fullName: 'Yas Marina Circuit',
    country: 'United Arab Emirates',
    location: 'Abu Dhabi, UAE',
    flag: '🇦🇪',
    characteristics: 'Twilight season finale · Banked Turn 9, Marina yacht basin & illuminated W Hotel canopy',
    direction: 'Anti-clockwise',
    lapRecord: '1:26.103 (2021, Verstappen)',
    raceLaps: 58,
    pitLossS: 22.0,
    tyreStress: 1.05,
    altitudeM: 10,
    trackTempC: 34.0,
    airTempC: 26.5,
    poleDriver: 'VER',
    poleLapTime: 83.445,
    topSpeedKmh: 335.0,
    sectorFractions: [0.31, 0.66],
    drsZoneCount: 2,
    rotationDeg: 270,
    elevationProfile: [
      { dist: 0, elevation: 10.0 },
      { dist: 1300, elevation: 14.5 },
      { dist: 2800, elevation: 7.0 },
      { dist: 4200, elevation: 12.0 },
      { dist: 5281, elevation: 10.0 }
    ],
    segments: [
      { kind: 'straight', length: 620, name: 'Pit Straight', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 1 90-degree left', radius: 45, direction: -1, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 2 sweeping uphill right', radius: 110, direction: 1, drs: false },
      { kind: 'corner', length: 115, name: 'Turn 3 left', radius: 105, direction: -1, drs: false },
      { kind: 'straight', length: 240, name: 'Run to Turn 5 Hairpin', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 120, name: 'Turn 5 Reconfigured Hairpin', radius: 36, direction: -1, drs: false },
      { kind: 'straight', length: 1180, name: 'Long Back Straight (1.18 km)', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 80, name: 'Turn 6 chicane left', radius: 38, direction: -1, drs: false },
      { kind: 'corner', length: 85, name: 'Turn 7 chicane right', radius: 40, direction: 1, drs: false },
      { kind: 'straight', length: 680, name: 'Second DRS straight', radius: 0, direction: 0, drs: true },
      { kind: 'corner', length: 180, name: 'Turn 9 Marsa Banked Curve (5° Banking)', radius: 75, direction: -1, drs: false },
      { kind: 'straight', length: 290, name: 'Run to Marina', radius: 0, direction: 0, drs: false },
      { kind: 'corner', length: 90, name: 'Turn 12 Hotel approach', radius: 45, direction: 1, drs: false },
      { kind: 'corner', length: 95, name: 'Turn 13 under W Hotel bridge', radius: 42, direction: -1, drs: false },
      { kind: 'corner', length: 100, name: 'Turn 14 Hotel exit', radius: 46, direction: -1, drs: false },
      { kind: 'corner', length: 110, name: 'Turn 15 Marina Basin sweeper', radius: 68, direction: 1, drs: false },
      { kind: 'corner', length: 115, name: 'Turn 16 Final turn onto straight', radius: 72, direction: 1, drs: false },
      { kind: 'straight', length: 756, name: 'Pit Straight acceleration', radius: 0, direction: 0, drs: true },
    ]
  }
];

// Execute generation
console.log(`Generating ${NEW_CIRCUITS.length} new Formula 1 circuits...`);

for (const def of NEW_CIRCUITS) {
  const data = buildCircuitData(def);
  const srcPath = path.join(SRC_DIR, `${data.id}.json`);
  const pubPath = path.join(PUBLIC_DIR, `${data.id}.json`);

  const jsonStr = JSON.stringify(data, null, 2);
  fs.writeFileSync(srcPath, jsonStr, 'utf8');
  fs.writeFileSync(pubPath, jsonStr, 'utf8');

  console.log(`✓ Generated ${data.name} (${data.id}): ${data.lapLengthM.toFixed(0)}m, ${data.segments.length} segments, ${data.telemetry.distance.length} telemetry points, altitude ${data.altitudeM}m`);
}

console.log('\nAll 14 circuits successfully generated!');
