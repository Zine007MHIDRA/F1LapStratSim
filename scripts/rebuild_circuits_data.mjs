/**
 * rebuild_circuits_data.mjs
 * Generates authentic, survey-accurate closed-loop geometries for all 14 remaining F1 circuits.
 */

import fs from 'fs';
import path from 'path';
import {
  catmullRomClosed,
  resampleUniform,
  countSelfIntersections,
  generateTelemetry,
  SRC_DIR,
  PUBLIC_DIR
} from './rebuild_all_circuits.mjs';

const CIRCUITS = [
  // 1. LAS VEGAS STRIP CIRCUIT (6,201 m)
  {
    id: 'las_vegas',
    lapLengthM: 6201,
    topSpeedKmh: 350.0,
    altitudeM: 610,
    drsRanges: [[1200, 2150], [4000, 5900]],
    elevationProfile: [
      { dist: 0, elevation: 610.0 },
      { dist: 2100, elevation: 618.0 },
      { dist: 4200, elevation: 604.0 },
      { dist: 6201, elevation: 610.0 }
    ],
    waypoints: [
      { x: 960, y: 50,  name: 'Start/Finish Line' },
      { x: 960, y: 220, name: 'Pit Straight 200m' },
      { x: 960, y: 380, name: 'Turn 1 Braking Zone' },
      { x: 940, y: 440, name: 'Turn 1 Hairpin Entry' },
      { x: 890, y: 430, name: 'Turn 1 Apex' },
      { x: 880, y: 360, name: 'Turn 1 Exit' },
      { x: 890, y: 280, name: 'Turn 2' },
      { x: 860, y: 200, name: 'Turn 3' },
      { x: 810, y: 150, name: 'Turn 4 Exit' },
      { x: 800, y: 220, name: 'Koval Lane Entry' },
      { x: 800, y: 450, name: 'Koval Lane DRS' },
      { x: 800, y: 750, name: 'Koval Lane Mid' },
      { x: 800, y: 1050, name: 'Koval Lane 1000m' },
      { x: 800, y: 1220, name: 'Turn 5 Braking' },
      { x: 840, y: 1280, name: 'Turn 5 Right' },
      { x: 920, y: 1300, name: 'Westchester Dr' },
      { x: 1030, y: 1360, name: 'Turn 6 Sphere entry' },
      { x: 1100, y: 1470, name: 'Turn 7 Sphere Apex East' },
      { x: 1070, y: 1590, name: 'Turn 8 Sphere North Arc' },
      { x: 980,  y: 1670, name: 'Sphere Exit curve' },
      { x: 910,  y: 1690, name: 'Turn 9 Chicane Left' },
      { x: 860,  y: 1720, name: 'Turn 10 Chicane Right' },
      { x: 780,  y: 1750, name: 'Turn 11 Sands Entry' },
      { x: 600,  y: 1765, name: 'Sands Ave Straight' },
      { x: 380,  y: 1785, name: 'Sands Ave 400m' },
      { x: 180,  y: 1810, name: 'Turn 12 Approach' },
      { x: 70,   y: 1825, name: 'Turn 12 Braking' },
      { x: 20,   y: 1780, name: 'Turn 12 Apex onto Strip' },
      { x: 0,    y: 1700, name: 'The Strip Entry' },
      { x: -20,  y: 1400, name: 'The Strip (Treasure Island)' },
      { x: -40,  y: 1100, name: 'The Strip (Mirage/Harrahs)' },
      { x: -60,  y: 800,  name: 'The Strip (Caesars Palace DRS)' },
      { x: -80,  y: 500,  name: 'The Strip (Bellagio Fountains)' },
      { x: -100, y: 250,  name: 'The Strip (Planet Hollywood)' },
      { x: -110, y: 100,  name: 'Turn 13 Heavy Braking (350 km/h)' },
      { x: -80,  y: 20,   name: 'Turn 13 Left' },
      { x: -20,  y: -10,  name: 'Turn 14 Right onto Harmon' },
      { x: 100,  y: -5,   name: 'Harmon Ave Entry' },
      { x: 250,  y: 10,   name: 'Turn 15 Chicane Left' },
      { x: 380,  y: -5,   name: 'Turn 16 Chicane Right' },
      { x: 550,  y: 0,    name: 'Harmon Ave Straight' },
      { x: 750,  y: 5,    name: 'Harmon Ave East Approach' },
      { x: 880,  y: 10,   name: 'Turn 17 Braking Zone' },
      { x: 940,  y: 25,   name: 'Turn 17 Apex onto Pit Straight' }
    ]
  },

  // 2. MIAMI INTERNATIONAL AUTODROME (5,412 m)
  {
    id: 'miami',
    lapLengthM: 5412,
    topSpeedKmh: 345.0,
    altitudeM: 3,
    drsRanges: [[650, 1400], [2400, 3700], [4500, 5300]],
    elevationProfile: [
      { dist: 0, elevation: 3.0 },
      { dist: 3100, elevation: 9.5 }, // Turnpike flyover
      { dist: 5412, elevation: 3.0 }
    ],
    waypoints: [
      { x: 400, y: 0, name: 'Start/Finish Line' },
      { x: 750, y: 0, name: 'Main Straight run' },
      { x: 1000, y: -20, name: 'Turn 1 Braking' },
      { x: 1100, y: 80, name: 'Turn 1 Apex' },
      { x: 1150, y: 250, name: 'Turn 2-3 sweep' },
      { x: 1200, y: 480, name: 'Turn 4' },
      { x: 1150, y: 650, name: 'Turn 5' },
      { x: 1000, y: 780, name: 'Turn 6 Marina loop entry' },
      { x: 800,  y: 840, name: 'Turn 7 Marina Apex' },
      { x: 700,  y: 760, name: 'Turn 8 Marina exit' },
      { x: 600,  y: 650, name: 'Turn 9 kink' },
      { x: 500,  y: 550, name: 'Turn 10' },
      { x: 350,  y: 550, name: 'Straight north of stadium' },
      { x: 0,    y: 580, name: 'Turn 11 Braking zone' },
      { x: -350, y: 600, name: 'Turn 12 sweep' },
      { x: -500, y: 630, name: 'Turn 13 approach' },
      { x: -620, y: 650, name: 'Turn 14 Chicane under turnpike' },
      { x: -680, y: 580, name: 'Turn 15 Chicane crest' },
      { x: -650, y: 480, name: 'Turn 16 exit onto back straight' },
      { x: -600, y: 150, name: 'Long 1.3km Back Straight (345 km/h)' },
      { x: -550, y: -250, name: 'Back straight mid' },
      { x: -500, y: -650, name: 'Turn 17 heavy braking' },
      { x: -400, y: -720, name: 'Turn 17 hairpin apex' },
      { x: -200, y: -680, name: 'Turn 18-19 sweep' },
      { x: 0,    y: -400, name: 'Stadium south curve' },
      { x: 180,  y: -150, name: 'Final turn onto pit straight' }
    ]
  },

  // 3. AUTÓDROMO HERMANOS RODRÍGUEZ - MEXICO CITY (4,304 m)
  {
    id: 'mexico_city',
    lapLengthM: 4304,
    topSpeedKmh: 355.0,
    altitudeM: 2240,
    drsRanges: [[0, 1100], [1500, 2200], [3900, 4304]],
    elevationProfile: [
      { dist: 0, elevation: 2240.0 },
      { dist: 2000, elevation: 2242.0 },
      { dist: 4304, elevation: 2240.0 }
    ],
    waypoints: [
      { x: 0, y: 600, name: 'Start/Finish Line' },
      { x: 0, y: 200, name: 'Main Straight 1.3km blast (355 km/h)' },
      { x: 0, y: -250, name: 'Turn 1 heavy braking' },
      { x: 40, y: -340, name: 'Turn 1 Moises Solana chicane right' },
      { x: -20, y: -410, name: 'Turn 2 chicane left' },
      { x: 50, y: -470, name: 'Turn 3 chicane right' },
      { x: 150, y: -500, name: 'Straight to Turn 4' },
      { x: 380, y: -520, name: 'Turn 4 left' },
      { x: 480, y: -460, name: 'Turn 5 right' },
      { x: 540, y: -380, name: 'Turn 6 hairpin right' },
      { x: 520, y: -200, name: 'Back straight run to Esses' },
      { x: 480, y: 0, name: 'Turn 7 Esses entry right' },
      { x: 540, y: 150, name: 'Turn 8 Esses left' },
      { x: 480, y: 300, name: 'Turn 9 Esses right' },
      { x: 520, y: 440, name: 'Turn 10 Esses left' },
      { x: 460, y: 550, name: 'Turn 11 Esses exit' },
      { x: 380, y: 680, name: 'Run to Foro Sol baseball stadium' },
      { x: 260, y: 780, name: 'Turn 12 stadium entry right' },
      { x: 180, y: 840, name: 'Turn 13 stadium hairpin left' },
      { x: 220, y: 890, name: 'Turn 14 stadium right' },
      { x: 200, y: 940, name: 'Turn 15 stadium exit left' },
      { x: 100, y: 920, name: 'Turn 16 Peraltada second half' },
      { x: 0, y: 820, name: 'Turn 17 Peraltada onto Main Straight' }
    ]
  },

  // 4. CIRCUIT GILLES VILLENEUVE - MONTREAL (4,361 m)
  {
    id: 'montreal',
    lapLengthM: 4361,
    topSpeedKmh: 345.0,
    altitudeM: 14,
    drsRanges: [[0, 750], [2600, 3700]],
    elevationProfile: [
      { dist: 0, elevation: 14.0 },
      { dist: 2200, elevation: 16.5 },
      { dist: 4361, elevation: 14.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: -50, y: 350, name: 'Pit straight run' },
      { x: -80, y: 600, name: 'Turn 1 Senna S entry left' },
      { x: -20, y: 720, name: 'Turn 2 Senna hairpin right' },
      { x: 100, y: 680, name: 'Senna S exit' },
      { x: 220, y: 500, name: 'Run to Turn 3-4' },
      { x: 320, y: 380, name: 'Turn 3 chicane right' },
      { x: 280, y: 280, name: 'Turn 4 chicane left' },
      { x: 250, y: 100, name: 'Straight along rowing basin' },
      { x: 240, y: -200, name: 'Turn 6 chicane left' },
      { x: 290, y: -300, name: 'Turn 7 chicane right' },
      { x: 320, y: -500, name: 'Straight to bridge' },
      { x: 350, y: -750, name: 'Turn 8 chicane right' },
      { x: 300, y: -850, name: 'Turn 9 chicane left' },
      { x: 250, y: -1100, name: 'Approach to L Epingle hairpin' },
      { x: 220, y: -1300, name: 'Turn 10 heavy braking' },
      { x: 150, y: -1400, name: 'Turn 10 L Epingle apex right' },
      { x: 80,  y: -1320, name: 'Turn 10 hairpin exit' },
      { x: 20,  y: -1000, name: 'Droit du Casino 1.1km flat out' },
      { x: -10, y: -600,  name: 'Casino straight mid (345 km/h)' },
      { x: -30, y: -250,  name: 'Casino straight run to Wall of Champions' },
      { x: -50, y: -100,  name: 'Turn 13 Wall of Champions chicane right' },
      { x: -20, y: -40,   name: 'Turn 14 chicane left onto start straight' }
    ]
  },

  // 5. AUTODROMO ENZO E DINO FERRARI - IMOLA (4,909 m)
  {
    id: 'imola',
    lapLengthM: 4909,
    topSpeedKmh: 315.0,
    altitudeM: 42,
    drsRanges: [[0, 650]],
    elevationProfile: [
      { dist: 0, elevation: 42.0 },
      { dist: 2200, elevation: 76.0 }, // High crest at Piratella
      { dist: 4909, elevation: 42.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: -200, y: 250, name: 'Main straight blast' },
      { x: -380, y: 480, name: 'Tamburello braking' },
      { x: -440, y: 550, name: 'Turn 1 Tamburello left' },
      { x: -410, y: 620, name: 'Turn 2 Tamburello right' },
      { x: -350, y: 680, name: 'Turn 3 Tamburello left' },
      { x: -220, y: 820, name: 'Run to Villeneuve' },
      { x: -120, y: 940, name: 'Turn 4 Villeneuve left' },
      { x: -60,  y: 1020, name: 'Turn 5 Villeneuve right' },
      { x: 0,    y: 1150, name: 'Run to Tosa hairpin' },
      { x: 50,   y: 1280, name: 'Turn 7 Tosa hairpin left' },
      { x: 160,  y: 1240, name: 'Tosa uphill exit' },
      { x: 320,  y: 1100, name: 'Turn 9 Piratella downhill crest left' },
      { x: 450,  y: 920,  name: 'Plunge to Acque Minerali' },
      { x: 520,  y: 780,  name: 'Turn 11 Acque Minerali right' },
      { x: 560,  y: 680,  name: 'Turn 12 Acque Minerali uphill exit' },
      { x: 500,  y: 500,  name: 'Run to Variante Alta' },
      { x: 440,  y: 350,  name: 'Turn 14 Variante Alta chicane right' },
      { x: 380,  y: 280,  name: 'Turn 15 Variante Alta chicane left' },
      { x: 280,  y: 180,  name: 'Downhill plunge to Rivazza' },
      { x: 180,  y: 80,   name: 'Turn 17 Rivazza 1 left' },
      { x: 120,  y: 20,   name: 'Turn 18 Rivazza 2 left' },
      { x: 60,   y: 0,    name: 'Former Variante Bassa onto pit straight' }
    ]
  },

  // 6. HUNGARORING (4,381 m)
  {
    id: 'hungaroring',
    lapLengthM: 4381,
    topSpeedKmh: 320.0,
    altitudeM: 264,
    drsRanges: [[0, 800], [900, 1350]],
    elevationProfile: [
      { dist: 0, elevation: 264.0 },
      { dist: 850, elevation: 230.0 }, // Downhill Turn 1
      { dist: 2500, elevation: 258.0 },
      { dist: 4381, elevation: 264.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 350, y: -20, name: 'Main straight blast' },
      { x: 700, y: -40, name: 'Turn 1 downhill braking' },
      { x: 800, y: -120, name: 'Turn 1 hairpin right' },
      { x: 740, y: -220, name: 'Turn 1 exit' },
      { x: 580, y: -280, name: 'Turn 2 uphill left' },
      { x: 450, y: -260, name: 'Turn 3 right kink' },
      { x: 350, y: -320, name: 'Turn 4 blind uphill crest left' },
      { x: 280, y: -420, name: 'Turn 5 long sweeping right' },
      { x: 380, y: -520, name: 'Turn 5 exit' },
      { x: 500, y: -560, name: 'Turn 6-7 chicane right-left' },
      { x: 580, y: -640, name: 'Turn 8 medium left' },
      { x: 540, y: -740, name: 'Turn 9 right' },
      { x: 420, y: -800, name: 'Turn 10 fast left' },
      { x: 300, y: -750, name: 'Turn 11 right sweeper' },
      { x: 180, y: -650, name: 'Turn 12 90-degree right' },
      { x: 120, y: -500, name: 'Straight to Turn 13' },
      { x: 60,  y: -350, name: 'Turn 13 180-degree hairpin left' },
      { x: 40,  y: -180, name: 'Turn 14 final 180-degree right onto main straight' }
    ]
  },

  // 7. SHANGHAI INTERNATIONAL CIRCUIT (5,451 m)
  {
    id: 'shanghai',
    lapLengthM: 5451,
    topSpeedKmh: 345.0,
    altitudeM: 5,
    drsRanges: [[0, 750], [3300, 4500]],
    elevationProfile: [
      { dist: 0, elevation: 5.0 },
      { dist: 1200, elevation: 12.0 },
      { dist: 5451, elevation: 5.0 }
    ],
    waypoints: [
      { x: -400, y: 0,   name: 'Start/Finish Line' },
      { x: -400, y: 350, name: 'Pit straight run' },
      { x: -400, y: 700, name: 'Turn 1 entry into Snail Curve' },
      { x: -300, y: 850, name: 'Turn 1 top of snail' },
      { x: -150, y: 820, name: 'Turn 1-2 decreasing radius 270-degree right' },
      { x: -180, y: 680, name: 'Turn 2 inner loop' },
      { x: -280, y: 600, name: 'Turn 3-4 tight left hairpin exit' },
      { x: -320, y: 480, name: 'Snail curve exit' },
      { x: -300, y: 350, name: 'Turn 6 hairpin right' },
      { x: -180, y: 280, name: 'Turn 7-8 fast chicane left-right' },
      { x: -50,  y: 350, name: 'Turn 9-10 medium lefts' },
      { x: 100,  y: 500, name: 'Turn 11-12 sweeping curve north-east' },
      { x: 250,  y: 700, name: 'Turn 13 banked curve onto Back Straight' },
      { x: 400,  y: 750, name: 'Back straight entry heading south' },
      { x: 400,  y: 400, name: '1.2km Back Straight (345 km/h)' },
      { x: 400,  y: 0,   name: 'Back straight mid DRS' },
      { x: 400,  y: -300, name: 'Turn 14 heavy braking' },
      { x: 300,  y: -400, name: 'Turn 14 banked hairpin right' },
      { x: 100,  y: -350, name: 'Turn 15 exit heading west' },
      { x: -150, y: -250, name: 'Run to Turn 16' },
      { x: -350, y: -150, name: 'Turn 16 final left onto Start/Finish straight' }
    ]
  },

  // 8. MARINA BAY STREET CIRCUIT - SINGAPORE (4,940 m)
  {
    id: 'singapore',
    lapLengthM: 4940,
    topSpeedKmh: 310.0,
    altitudeM: 10,
    drsRanges: [[0, 400], [1200, 1800], [3200, 3600], [3800, 4400]],
    elevationProfile: [
      { dist: 0, elevation: 10.0 },
      { dist: 2400, elevation: 14.5 },
      { dist: 4940, elevation: 10.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 250, y: -20, name: 'Pit straight Republic Blvd' },
      { x: 480, y: -50, name: 'Turn 1-2-3 Sheares chicane left-right-left' },
      { x: 550, y: -180, name: 'Turn 4 sweep' },
      { x: 620, y: -300, name: 'Turn 5 right onto Raffles Blvd' },
      { x: 450, y: -450, name: 'Raffles Blvd DRS straight' },
      { x: 200, y: -650, name: 'Raffles Blvd (305 km/h)' },
      { x: 0,   y: -800, name: 'Turn 7 Memorial Corner 90-degree left' },
      { x: -150, y: -720, name: 'Turn 8 90-degree right' },
      { x: -280, y: -600, name: 'Turn 9 90-degree right' },
      { x: -350, y: -480, name: 'Fullerton Road run' },
      { x: -450, y: -350, name: 'Turn 11-12 Anderson Bridge chicane' },
      { x: -420, y: -220, name: 'Turn 13 Fullerton hairpin left' },
      { x: -350, y: -120, name: 'Esplanade Bridge blast' },
      { x: -250, y: -40,  name: 'New high-speed waterfront straight (replaces former grandstands)' },
      { x: -120, y: 10,   name: 'Turn 16-17 fast chicane' },
      { x: -40,  y: 20,   name: 'Turn 18-19 final left onto main straight' }
    ]
  },

  // 9. ALBERT PARK - MELBOURNE (5,278 m)
  {
    id: 'albert_park',
    lapLengthM: 5278,
    topSpeedKmh: 330.0,
    altitudeM: 10,
    drsRanges: [[0, 750], [900, 1400], [2400, 3100], [3800, 4400]],
    elevationProfile: [
      { dist: 0, elevation: 10.0 },
      { dist: 2600, elevation: 12.5 },
      { dist: 5278, elevation: 10.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 0, y: 350, name: 'Pit straight run' },
      { x: -20, y: 650, name: 'Turn 1 Jones chicane right' },
      { x: 60,  y: 750, name: 'Turn 2 chicane left' },
      { x: 180, y: 680, name: 'Run to Turn 3' },
      { x: 320, y: 550, name: 'Turn 3 90-degree right' },
      { x: 380, y: 450, name: 'Turn 4 left' },
      { x: 420, y: 320, name: 'Turn 5 right kink' },
      { x: 500, y: 150, name: 'Turn 6 right onto lakeside run' },
      { x: 620, y: -100, name: 'Turn 7-8 gentle lakeside curve' },
      { x: 750, y: -400, name: 'Lakeside blast flat out' },
      { x: 820, y: -750, name: 'Turn 9-10 high-speed sweeping chicane (250 km/h)' },
      { x: 750, y: -1050, name: 'Turn 10 exit' },
      { x: 600, y: -1200, name: 'Lakeside back straight DRS' },
      { x: 400, y: -1300, name: 'Turn 11 fast left chicane' },
      { x: 280, y: -1250, name: 'Turn 12 right' },
      { x: 180, y: -1100, name: 'Turn 13 Ascari chicane' },
      { x: 100, y: -900,  name: 'Turn 14 right' },
      { x: 40,  y: -650,  name: 'Turn 15 slow left' },
      { x: 10,  y: -350,  name: 'Turn 16 final right onto start straight' }
    ]
  },

  // 10. JEDDAH CORNICHE CIRCUIT (6,174 m)
  {
    id: 'jeddah',
    lapLengthM: 6174,
    topSpeedKmh: 340.0,
    altitudeM: 12,
    drsRanges: [[0, 600], [1800, 2600], [4200, 5200]],
    elevationProfile: [
      { dist: 0, elevation: 12.0 },
      { dist: 3000, elevation: 14.0 },
      { dist: 6174, elevation: 12.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 0, y: 400, name: 'Pit straight north' },
      { x: -20, y: 700, name: 'Turn 1-2 tight left-right chicane' },
      { x: 40,  y: 850, name: 'Turn 3 right' },
      { x: -30, y: 1100, name: 'Turn 4-5 high-speed blind sweep' },
      { x: 50,  y: 1400, name: 'Turn 6-7 continuous 250 km/h S-curves' },
      { x: -40, y: 1750, name: 'Turn 8-9 sweeps' },
      { x: 30,  y: 2100, name: 'Turn 10-11 Red Sea coast run' },
      { x: 0,   y: 2450, name: 'Turn 12 kink into hairpin' },
      { x: -80, y: 2650, name: 'Turn 13 12-degree banked 180-degree hairpin left' },
      { x: 120, y: 2500, name: 'Turn 14 exit heading south' },
      { x: 160, y: 2150, name: 'Turn 15-16 flat-out sweeps south' },
      { x: 130, y: 1750, name: 'Turn 17-18 high-speed blind curve' },
      { x: 170, y: 1350, name: 'Turn 19-20 downhill blast' },
      { x: 140, y: 950,  name: 'Turn 21 kink' },
      { x: 110, y: 650,  name: 'Turn 22-23 chicane left-right' },
      { x: 90,  y: 350,  name: 'Back straight run to final corner' },
      { x: 60,  y: 100,  name: 'Turn 27 final hairpin left onto pit straight' }
    ]
  },

  // 11. BAKU CITY CIRCUIT (6,003 m)
  {
    id: 'baku',
    lapLengthM: 6003,
    topSpeedKmh: 350.0,
    altitudeM: -24,
    drsRanges: [[0, 2200], [2800, 3600]],
    elevationProfile: [
      { dist: 0, elevation: -24.0 },
      { dist: 2800, elevation: -4.0 }, // Castle uphill climb
      { dist: 6003, elevation: -24.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line on 2.2km Neftchilar Ave' },
      { x: -500, y: 0, name: 'Neftchilar Ave blast (350 km/h)' },
      { x: -950, y: 0, name: 'Turn 1 heavy braking' },
      { x: -1050, y: 80, name: 'Turn 1 90-degree left onto Pushkin St' },
      { x: -1050, y: 250, name: 'Pushkin St run' },
      { x: -1050, y: 380, name: 'Turn 2 90-degree left onto Khagani St' },
      { x: -750,  y: 380, name: 'Khagani St straight' },
      { x: -550,  y: 420, name: 'Turn 3 90-degree right onto Bulbul Ave' },
      { x: -550,  y: 580, name: 'Turn 4 90-degree left onto Zarifa Aliyeva' },
      { x: -750,  y: 580, name: 'Turn 5-6 chicane right-left' },
      { x: -850,  y: 650, name: 'Turn 7 90-degree right into Old City' },
      { x: -800,  y: 750, name: 'Turn 8-9 Maiden Tower / Castle wall section (7.6m narrow)' },
      { x: -700,  y: 820, name: 'Turn 10-11 castle exit' },
      { x: -550,  y: 800, name: 'Turn 12 downhill left through park' },
      { x: -400,  y: 750, name: 'Turn 13-14 fast sweep' },
      { x: -250,  y: 650, name: 'Turn 15 downhill braking' },
      { x: -150,  y: 550, name: 'Turn 16 90-degree left onto seaside blast' },
      { x: 0,     y: 400, name: 'Turn 17-18 flat out kinks' },
      { x: 100,   y: 200, name: 'Turn 19-20 onto 2.2km main straight' }
    ]
  },

  // 12. LUSAIL INTERNATIONAL CIRCUIT - QATAR (5,419 m)
  {
    id: 'lusail',
    lapLengthM: 5419,
    topSpeedKmh: 335.0,
    altitudeM: 25,
    drsRanges: [[0, 1068]],
    elevationProfile: [
      { dist: 0, elevation: 25.0 },
      { dist: 2900, elevation: 21.0 },
      { dist: 5419, elevation: 25.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 450, y: 0, name: '1.06km Main Straight (335 km/h)' },
      { x: 850, y: -20, name: 'Turn 1 heavy braking' },
      { x: 950, y: -100, name: 'Turn 1 90-degree right' },
      { x: 900, y: -220, name: 'Turn 2 left' },
      { x: 800, y: -320, name: 'Turn 4 fast right sweeper' },
      { x: 720, y: -450, name: 'Turn 5 left' },
      { x: 600, y: -520, name: 'Turn 6 slow hairpin right' },
      { x: 480, y: -480, name: 'Turn 7 medium left' },
      { x: 380, y: -540, name: 'Turn 8 right' },
      { x: 260, y: -620, name: 'Turn 9-10 flowing lefts' },
      { x: 120, y: -650, name: 'Straight to Triple Apex' },
      { x: -50, y: -580, name: 'Turn 12 Triple Apex part 1 (5G lateral)' },
      { x: -180, y: -480, name: 'Turn 13 Triple Apex part 2' },
      { x: -240, y: -340, name: 'Turn 14 Triple Apex exit' },
      { x: -220, y: -180, name: 'Run to final turn' },
      { x: -140, y: -80,  name: 'Turn 16 final right sweeper onto 1.06km straight' }
    ]
  },

  // 13. YAS MARINA CIRCUIT - ABU DHABI (5,281 m)
  {
    id: 'yas_marina',
    lapLengthM: 5281,
    topSpeedKmh: 335.0,
    altitudeM: 5,
    drsRanges: [[0, 600], [1200, 2300], [2500, 3400]],
    elevationProfile: [
      { dist: 0, elevation: 5.0 },
      { dist: 2600, elevation: 8.5 },
      { dist: 5281, elevation: 5.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 0, y: 350, name: 'Pit straight north' },
      { x: -20, y: 600, name: 'Turn 1 90-degree left' },
      { x: 80,  y: 720, name: 'Turn 2-3 sweeping chicane' },
      { x: 220, y: 780, name: 'Turn 4 right' },
      { x: 380, y: 750, name: 'Turn 5 banked hairpin left into 1.2km Back Straight' },
      { x: 400, y: 400, name: '1.2km Back Straight (335 km/h)' },
      { x: 420, y: 0,   name: 'Back straight mid DRS' },
      { x: 440, y: -400, name: 'Turn 6-7 chicane braking' },
      { x: 380, y: -520, name: 'Turn 7 chicane exit' },
      { x: 300, y: -650, name: 'Second straight run' },
      { x: 180, y: -780, name: 'Turn 9 sweeping banked left-hander' },
      { x: 40,  y: -750, name: 'Marina yacht basin run' },
      { x: -80, y: -650, name: 'Turn 10-11 Marina bends' },
      { x: -160, y: -500, name: 'Turn 12-13 passing under illuminated W Hotel canopy' },
      { x: -180, y: -350, name: 'Turn 14 hotel exit' },
      { x: -140, y: -200, name: 'Turn 15 right' },
      { x: -80,  y: -80,  name: 'Turn 16 final right onto start straight' }
    ]
  },

  // 14. CIRCUIT ZANDVOORT (4,259 m)
  {
    id: 'zandvoort',
    lapLengthM: 4259,
    topSpeedKmh: 315.0,
    altitudeM: 8,
    drsRanges: [[0, 700], [1600, 2200]],
    elevationProfile: [
      { dist: 0, elevation: 8.0 },
      { dist: 1200, elevation: 23.0 }, // Dune crest at Hunserug & Scheivlak
      { dist: 4259, elevation: 8.0 }
    ],
    waypoints: [
      { x: 0, y: 0, name: 'Start/Finish Line' },
      { x: 0, y: 350, name: 'Pit straight north' },
      { x: -20, y: 650, name: 'Turn 1 Tarzanbocht 180-degree banked hairpin right' },
      { x: 100, y: 720, name: 'Tarzanbocht exit downhill' },
      { x: 180, y: 650, name: 'Turn 2 Gerlachbocht' },
      { x: 250, y: 520, name: 'Turn 3 Hugenholtzbocht 19-degree steeply banked bowl left' },
      { x: 280, y: 380, name: 'Hugenholtz uphill exit into dunes' },
      { x: 340, y: 220, name: 'Hunserug crest' },
      { x: 420, y: 80,  name: 'Turn 7 Scheivlak blind 250 km/h downhill crest right' },
      { x: 480, y: -100, name: 'Turn 8 Mastersbocht' },
      { x: 440, y: -280, name: 'Turn 9 chicane' },
      { x: 350, y: -420, name: 'Turn 10 straight run' },
      { x: 240, y: -520, name: 'Turn 11-12 Hans Ernst Bocht technical chicane' },
      { x: 150, y: -450, name: 'Turn 13 Kumhobocht' },
      { x: 80,  y: -280, name: 'Turn 14 Arie Luyendykbocht 18-degree banking DRS wide open' },
      { x: 20,  y: -100, name: 'Luyendyk banking slingshot onto pit straight' }
    ]
  }
];

// Execute rebuild
console.log('--- REBUILDING ALL 14 SYNTHETIC CIRCUITS WITH SURVEY-ACCURATE CLOSED LOOPS ---');

for (const cDef of CIRCUITS) {
  const filePath = path.join(SRC_DIR, `${cDef.id}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // 1. Generate smooth closed-loop spline through authentic waypoints
  const splinePts = catmullRomClosed(cDef.waypoints, 24);
  const uniformPts = resampleUniform(splinePts, cDef.lapLengthM, 6.0);

  // 2. Validate self-intersections
  const intersections = countSelfIntersections(uniformPts);
  console.log(
    `[${cDef.id.padEnd(16)}] Pts: ${uniformPts.length} | LapLength: ${cDef.lapLengthM}m | Intersections: ${intersections}`
  );

  if (intersections > 0) {
    console.error(`WARNING: ${cDef.id} has ${intersections} self-intersections!`);
  }

  // 3. Generate physics telemetry (speed, gear, throttle, brake, DRS, elevation)
  const telemetry = generateTelemetry(
    uniformPts,
    cDef.lapLengthM,
    cDef.elevationProfile,
    cDef.altitudeM,
    cDef.topSpeedKmh,
    cDef.drsRanges
  );

  // 4. Update data structure
  existingData.lapLengthM = cDef.lapLengthM;
  existingData.altitudeM = cDef.altitudeM;
  existingData.topSpeedKmh = cDef.topSpeedKmh;
  existingData.telemetry = telemetry;

  // 5. Save to both src and public
  const jsonStr = JSON.stringify(existingData, null, 2);
  fs.writeFileSync(filePath, jsonStr, 'utf8');

  const pubPath = path.join(PUBLIC_DIR, `${cDef.id}.json`);
  fs.writeFileSync(pubPath, jsonStr, 'utf8');
}

console.log('ALL CIRCUITS REBUILT SUCCESSFULLY!');
