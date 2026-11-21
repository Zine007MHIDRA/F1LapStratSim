// test_las_vegas_geometry.mjs
import fs from 'fs';

// Centripetal Catmull-Rom spline interpolation for closed 2D loops
function catmullRomClosed(points, samplesPerSegment = 20) {
  const n = points.length;
  const result = [];

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    for (let t = 0; t < samplesPerSegment; t++) {
      const u = t / samplesPerSegment;
      const u2 = u * u;
      const u3 = u2 * u;

      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * u +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
      );

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * u +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
      );

      result.push({ x, y });
    }
  }

  return result;
}

function linesIntersect(p1, p2, p3, p4) {
  function ccw(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

// Las Vegas authentic street grid waypoints (meters)
// Origin (0,0) near Harmon Ave & The Strip intersection
const waypoints = [
  // 1. Start/Finish Straight (permanent F1 facility east of Koval, heading North)
  { x: 960, y: 50,  name: 'Start/Finish Line' },
  { x: 960, y: 220, name: 'Pit Straight 200m' },
  { x: 960, y: 380, name: 'Turn 1 Braking Zone' },

  // 2. Turn 1 Hairpin (tight left hairpin turning South)
  { x: 940, y: 440, name: 'Turn 1 Hairpin Entry' },
  { x: 890, y: 430, name: 'Turn 1 Apex' },
  { x: 880, y: 360, name: 'Turn 1 Exit' },

  // 3. Turns 2, 3, 4 complex (transitioning westward out to Koval Lane)
  { x: 890, y: 280, name: 'Turn 2' },
  { x: 860, y: 200, name: 'Turn 3' },
  { x: 810, y: 150, name: 'Turn 4 Exit' },
  { x: 800, y: 220, name: 'Koval Lane Entry' },

  // 4. Koval Lane Straight (heading North parallel down Koval Lane, ~950m)
  { x: 800, y: 450, name: 'Koval Lane DRS' },
  { x: 800, y: 750, name: 'Koval Lane Mid' },
  { x: 800, y: 1050, name: 'Koval Lane 1000m' },
  { x: 800, y: 1220, name: 'Turn 5 Braking' },

  // 5. Turn 5: Sharp 90-degree right-hander into MSG Sphere zone
  { x: 840, y: 1280, name: 'Turn 5 Right' },
  { x: 920, y: 1300, name: 'Westchester Dr' },

  // 6. Turns 6, 7, 8: Long sweeping multi-apex curve looping around the MSG Sphere
  { x: 1030, y: 1360, name: 'Turn 6 Sphere entry' },
  { x: 1100, y: 1470, name: 'Turn 7 Sphere Apex East' },
  { x: 1070, y: 1590, name: 'Turn 8 Sphere North Arc' },
  { x: 980,  y: 1670, name: 'Sphere Exit curve' },

  // 7. Turns 9 & 10: Technical chicane sequence away from Sphere
  { x: 910,  y: 1690, name: 'Turn 9 Chicane Left' },
  { x: 860,  y: 1720, name: 'Turn 10 Chicane Right' },

  // 8. Turn 11: Sweeping left bend onto Sands Avenue
  { x: 780,  y: 1750, name: 'Turn 11 Sands Entry' },

  // 9. Sands Avenue Straight (heading West toward the Strip, ~750m)
  { x: 600,  y: 1765, name: 'Sands Ave Straight' },
  { x: 380,  y: 1785, name: 'Sands Ave 400m' },
  { x: 180,  y: 1810, name: 'Turn 12 Approach' },
  { x: 70,   y: 1825, name: 'Turn 12 Braking' },

  // 10. Turn 12: High-speed left bend connecting Sands Ave onto The Strip
  { x: 20,   y: 1780, name: 'Turn 12 Apex onto Strip' },
  { x: 0,    y: 1700, name: 'The Strip Entry' },

  // 11. The Las Vegas Strip Straight (1.9 km flat-out blast heading south past Bellagio/Caesars)
  { x: -20,  y: 1400, name: 'The Strip (Treasure Island)' },
  { x: -40,  y: 1100, name: 'The Strip (Mirage/Harrahs)' },
  { x: -60,  y: 800,  name: 'The Strip (Caesars Palace DRS)' },
  { x: -80,  y: 500,  name: 'The Strip (Bellagio Fountains)' },
  { x: -100, y: 250,  name: 'The Strip (Planet Hollywood)' },
  { x: -110, y: 100,  name: 'Turn 13 Heavy Braking (350 km/h)' },

  // 12. Turns 13 & 14: Tight low-speed sequence turning onto Harmon Avenue
  { x: -80,  y: 20,   name: 'Turn 13 Left' },
  { x: -20,  y: -10,  name: 'Turn 14 Right onto Harmon' },

  // 13. Turns 15 & 16: Fast sweeping chicane on Harmon Avenue
  { x: 100,  y: -5,   name: 'Harmon Ave Entry' },
  { x: 250,  y: 10,   name: 'Turn 15 Chicane Left' },
  { x: 380,  y: -5,   name: 'Turn 16 Chicane Right' },
  { x: 550,  y: 0,    name: 'Harmon Ave Straight' },
  { x: 750,  y: 5,    name: 'Harmon Ave East Approach' },
  { x: 880,  y: 10,   name: 'Turn 17 Braking Zone' },

  // 14. Turn 17: High-speed left-hander back onto Start/Finish straight
  { x: 940,  y: 25,   name: 'Turn 17 Apex onto Pit Straight' }
];

const smoothed = catmullRomClosed(waypoints, 20);
console.log('Smoothed points:', smoothed.length);

let totalDist = 0;
for (let i = 0; i < smoothed.length; i++) {
  const p1 = smoothed[i];
  const p2 = smoothed[(i + 1) % smoothed.length];
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  totalDist += d;
}
console.log('Perimeter length:', Math.round(totalDist), 'm (target ~6201m)');

let intersections = 0;
const step = 4;
for (let i = 0; i < smoothed.length - step; i += step) {
  const p1 = smoothed[i];
  const p2 = smoothed[i + step];
  for (let j = i + 2 * step; j < smoothed.length - step; j += step) {
    if (i === 0 && j >= smoothed.length - 2 * step) continue;
    const p3 = smoothed[j];
    const p4 = smoothed[j + step];
    if (linesIntersect(p1, p2, p3, p4)) {
      intersections++;
      console.log('Intersection between i=' + i + ' and j=' + j);
    }
  }
}
console.log('Intersections:', intersections);
