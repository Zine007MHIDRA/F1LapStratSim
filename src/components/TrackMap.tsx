'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CircuitData, LapSimulationResult } from '../engine/types';
import {
  DRIVERS,
  SESSIONS_LIST,
  SessionType,
  getDriver,
  getDriverSessionStats,
  DriverProfile,
  DriverSessionStats,
} from '../data/driverSessions';
import { getParticipatingDrivers, RaceParticipant } from '../data/raceParticipants';
import {
  Play,
  Pause,
  RotateCcw,
  Radio,
  Activity,
  Compass,
} from 'lucide-react';

interface TrackMapProps {
  circuit: CircuitData;
  activeDistanceM?: number;
  onHoverDistance?: (distM: number) => void;
  simulation?: LapSimulationResult;
  className?: string;
  era?: '2025' | '2026';
}

export type TrackViewMode = 'broadcast' | 'elevation' | 'heatmap' | 'drs' | 'sectors';

export default function TrackMap({
  circuit,
  activeDistanceM = 0,
  onHoverDistance,
  simulation,
  className = '',
  era = '2025',
}: TrackMapProps) {
  const telemetry = circuit.telemetry;
  const lapLength = circuit.lapLengthM || 5000;

  // Participating drivers for this specific circuit and era
  const participants: RaceParticipant[] = useMemo(() => {
    return getParticipatingDrivers(circuit.id, era);
  }, [circuit.id, era]);

  // Driver & Session selection state
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    circuit.poleDriver?.toLowerCase() || participants[0]?.driverId || 'nor'
  );

  // Sync selected driver if not in current race participants list
  useEffect(() => {
    if (participants.length > 0) {
      const exists = participants.some((p) => p.driverId === selectedDriverId);
      if (!exists) {
        setSelectedDriverId(participants[0].driverId);
      }
    }
  }, [participants, selectedDriverId]);

  const [selectedSession, setSelectedSession] = useState<SessionType>('qualifying');
  const [ghostModeEnabled, setGhostModeEnabled] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<TrackViewMode>('broadcast');
  const [showCorners, setShowCorners] = useState<boolean>(true);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 2x default for smooth preview
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const localDistRef = useRef<number>(activeDistanceM);

  // Sync ref
  useEffect(() => {
    localDistRef.current = activeDistanceM;
  }, [activeDistanceM]);

  // Active driver and session stats
  const activeDriver: DriverProfile = useMemo(() => getDriver(selectedDriverId), [selectedDriverId]);
  const sessionStats: DriverSessionStats = useMemo(() => {
    return getDriverSessionStats(
      circuit.id,
      circuit.poleLapTime,
      circuit.topSpeedKmh,
      circuit.sectorFractions,
      selectedDriverId,
      selectedSession,
      era
    );
  }, [circuit, selectedDriverId, selectedSession, era]);

  // Physics-accurate dynamic animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
      return;
    }

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000.0;
      lastTimeRef.current = time;

      // Ingest instantaneous velocity at current position for realistic physics playback
      const dists = telemetry.distance;
      const speeds = telemetry.speed;
      let curVkmh = 240;

      if (dists && dists.length > 0 && speeds && speeds.length > 0) {
        const curDist = localDistRef.current;
        let closest = 0;
        let minD = Infinity;
        for (let i = 0; i < dists.length; i++) {
          const diff = Math.abs(dists[i] - curDist);
          if (diff < minD) {
            minD = diff;
            closest = i;
          }
        }
        curVkmh = speeds[closest] || 240;
      }

      // Convert km/h to m/s
      const currentSpeedMps = curVkmh / 3.6;
      const deltaM = currentSpeedMps * dt * playbackSpeed;
      const nextDist = (localDistRef.current + deltaM) % lapLength;
      localDistRef.current = nextDist;

      if (onHoverDistance) {
        onHoverDistance(nextDist);
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
    };
  }, [isPlaying, lapLength, playbackSpeed, onHoverDistance, telemetry]);

  // Geometric normalization, SVG paths, Pit Lane, and Start/Finish Line
  const {
    pathData,
    segmentsPath,
    pitLanePath,
    startFinishLine,
    cornerLabels,
    drsSegments,
    speedTrapCoord,
    carCoord,
    ghostCoord,
    carTrailPath,
    ghostTrailPath,
    currentMetrics,
    ghostDeltaS,
    viewBox,
    viewWidth,
    viewHeight,
  } = useMemo(() => {
    const xs = telemetry.x;
    const ys = telemetry.y;
    const dists = telemetry.distance;
    const speeds = telemetry.speed;

    if (!xs || xs.length === 0) {
      return {
        pathData: '',
        segmentsPath: [],
        pitLanePath: '',
        startFinishLine: null,
        cornerLabels: [],
        drsSegments: [],
        speedTrapCoord: null,
        carCoord: null,
        ghostCoord: null,
        carTrailPath: '',
        ghostTrailPath: '',
        currentMetrics: { speed: 0, gear: 1, throttle: 0, brake: 0, dist: 0 },
        ghostDeltaS: 0,
        viewBox: '0 0 1000 1000',
        viewWidth: 1000,
        viewHeight: 1000,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i];
      if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i];
      if (ys[i] > maxY) maxY = ys[i];
      sumX += xs[i];
      sumY += ys[i];
    }

    const centroidX = sumX / xs.length;
    const centroidY = sumY / xs.length;

    const pad = Math.max(maxX - minX, maxY - minY) * 0.10;
    const width = maxX - minX + 2 * pad;
    const height = maxY - minY + 2 * pad;
    const offsetX = minX - pad;
    const offsetY = minY - pad;

    const toSvg = (rx: number, ry: number) => ({
      x: rx - offsetX,
      y: maxY + pad - ry,
    });

    // 1. Build main track ribbon SVG path
    let fullD = '';
    const segs: { d: string; color: string; elevColor: string; speed: number; dist: number; sector: number }[] = [];
    const s1Cut = lapLength * circuit.sectorFractions[0];
    const s2Cut = lapLength * circuit.sectorFractions[1];

    const zs = telemetry.z || [];
    const minZ = zs.length > 0 ? Math.min(...zs) : 0;
    const maxZ = zs.length > 0 ? Math.max(...zs) : 0;
    const zRange = maxZ - minZ || 1;

    for (let i = 0; i < xs.length; i++) {
      const p1 = toSvg(xs[i], ys[i]);
      if (i === 0) {
        fullD += `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      } else {
        fullD += ` L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      }

      const nextIdx = (i + 1) % xs.length;
      const p2 = toSvg(xs[nextIdx], ys[nextIdx]);
      const spd = speeds[i] || 200;
      const dist = dists[i] || 0;

      let spdColor = '#00F0FF';
      if (spd < 130) spdColor = '#FF2800';
      else if (spd < 220) spdColor = '#FFB300';
      else if (spd < 280) spdColor = '#00E676';

      // 3D elevation color: low altitude cyan -> mid green -> climb yellow -> summit red
      const zVal = zs[i] !== undefined ? zs[i] : minZ;
      const zNorm = (zVal - minZ) / zRange;
      let elevColor = '#00F0FF';
      if (zNorm > 0.70) elevColor = '#FF2800';
      else if (zNorm > 0.45) elevColor = '#FFB300';
      else if (zNorm > 0.20) elevColor = '#00E676';

      const sector = dist < s1Cut ? 1 : dist < s2Cut ? 2 : 3;

      segs.push({
        d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
        color: spdColor,
        elevColor,
        speed: spd,
        dist,
        sector,
      });
    }
    fullD += ' Z';

    // 2. Start / Finish Line at distance 0
    let sfLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
    if (xs.length > 1) {
      const p0 = toSvg(xs[0], ys[0]);
      const p1 = toSvg(xs[1], ys[1]);
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const halfW = 22;
      const forwardSkew = 5;
      sfLine = {
        x1: p0.x - nx * halfW - (dx / len) * forwardSkew,
        y1: p0.y - ny * halfW - (dy / len) * forwardSkew,
        x2: p0.x + nx * halfW + (dx / len) * forwardSkew,
        y2: p0.y + ny * halfW + (dy / len) * forwardSkew,
      };
    }

    // 3. Realistic Pit Lane Bypass Geometry
    let pitPathD = '';
    const pitWindowDist = Math.min(420, lapLength * 0.12);
    const pitPoints: { x: number; y: number; dist: number }[] = [];

    for (let i = 0; i < xs.length; i++) {
      const d = dists[i];
      if (d > lapLength - pitWindowDist || d < pitWindowDist) {
        const nextIdx = (i + 1) % xs.length;
        const dx = xs[nextIdx] - xs[i];
        const dy = ys[nextIdx] - ys[i];
        const len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len;
        let ny = dx / len;

        const toCentroidX = centroidX - xs[i];
        const toCentroidY = centroidY - ys[i];
        if (nx * toCentroidX + ny * toCentroidY < 0) {
          nx = -nx;
          ny = -ny;
        }

        let offsetMag = 22.0;
        if (d > lapLength - pitWindowDist) {
          const entryFrac = (d - (lapLength - pitWindowDist)) / 120;
          offsetMag = Math.min(22.0, Math.max(0, entryFrac * 22.0));
        } else if (d < pitWindowDist) {
          const exitFrac = (pitWindowDist - d) / 120;
          offsetMag = Math.min(22.0, Math.max(0, exitFrac * 22.0));
        }

        const pitRawX = xs[i] + nx * offsetMag;
        const pitRawY = ys[i] + ny * offsetMag;
        const svgP = toSvg(pitRawX, pitRawY);
        pitPoints.push({ x: svgP.x, y: svgP.y, dist: d });
      }
    }

    pitPoints.sort((a, b) => {
      const orderA = a.dist > lapLength - pitWindowDist ? a.dist - lapLength : a.dist;
      const orderB = b.dist > lapLength - pitWindowDist ? b.dist - lapLength : b.dist;
      return orderA - orderB;
    });

    if (pitPoints.length > 2) {
      pitPathD = `M ${pitPoints[0].x.toFixed(1)} ${pitPoints[0].y.toFixed(1)}`;
      for (let k = 1; k < pitPoints.length; k++) {
        pitPathD += ` L ${pitPoints[k].x.toFixed(1)} ${pitPoints[k].y.toFixed(1)}`;
      }
    }

    // 4. Corner apex badges
    const corners: { name: string; number: number; x: number; y: number }[] = [];
    let cornerCount = 0;
    let runningDist = 0;

    for (const seg of circuit.segments) {
      if (seg.kind === 'corner') {
        cornerCount++;
        const apexDist = runningDist + seg.length * 0.5;

        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < dists.length; i++) {
          const diff = Math.abs(dists[i] - apexDist);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        const svgP = toSvg(xs[closestIdx], ys[closestIdx]);
        const vx = svgP.x - (centroidX - offsetX);
        const vy = svgP.y - (maxY + pad - centroidY);
        const vLen = Math.hypot(vx, vy) || 1;
        const pushDist = 28;

        corners.push({
          name: seg.name,
          number: cornerCount,
          x: svgP.x + (vx / vLen) * pushDist,
          y: svgP.y + (vy / vLen) * pushDist,
        });
      }
      runningDist += seg.length;
    }

    // 5. DRS Zones
    const drsLines: string[] = [];
    runningDist = 0;
    for (const seg of circuit.segments) {
      if (seg.drs) {
        const startD = runningDist;
        const endD = runningDist + seg.length;
        let zoneD = '';
        let hasStarted = false;
        for (let i = 0; i < dists.length; i++) {
          if (dists[i] >= startD && dists[i] <= endD) {
            const sp = toSvg(xs[i], ys[i]);
            if (!hasStarted) {
              zoneD += `M ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`;
              hasStarted = true;
            } else {
              zoneD += ` L ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`;
            }
          }
        }
        if (zoneD) drsLines.push(zoneD);
      }
      runningDist += seg.length;
    }

    // 6. Active Car Position & Metrics
    let car: { x: number; y: number; speed: number; angle: number; idx: number } | null = null;
    let metrics = { speed: 0, gear: 1, throttle: 0, brake: 0, dist: Math.round(activeDistanceM) };
    let carClosestIdx = 0;

    if (dists && dists.length > 0) {
      let minDiff = Infinity;
      for (let i = 0; i < dists.length; i++) {
        const diff = Math.abs(dists[i] - activeDistanceM);
        if (diff < minDiff) {
          minDiff = diff;
          carClosestIdx = i;
        }
      }
      const nextIdx = (carClosestIdx + 1) % xs.length;
      const curSvg = toSvg(xs[carClosestIdx], ys[carClosestIdx]);
      const nextSvg = toSvg(xs[nextIdx], ys[nextIdx]);
      const angle = Math.atan2(nextSvg.y - curSvg.y, nextSvg.x - curSvg.x) * (180 / Math.PI);

      car = {
        x: curSvg.x,
        y: curSvg.y,
        speed: speeds[carClosestIdx] || 0,
        angle,
        idx: carClosestIdx,
      };

      metrics = {
        speed: Math.round(speeds[carClosestIdx] || 0),
        gear: telemetry.gear[carClosestIdx] || 1,
        throttle: telemetry.throttle ? Math.round(telemetry.throttle[carClosestIdx] || 0) : 0,
        brake: telemetry.brake ? Math.round(telemetry.brake[carClosestIdx] || 0) : 0,
        dist: Math.round(activeDistanceM),
      };
    }

    // 7. Trailing Line for Player Car
    let trailD = '';
    if (car) {
      const trailLengthM = 320;
      const trailPoints: { x: number; y: number }[] = [];
      const totalN = xs.length;

      for (let stepBack = 0; stepBack < 45; stepBack++) {
        const idx = (carClosestIdx - stepBack + totalN) % totalN;
        const dDiff = (activeDistanceM - dists[idx] + lapLength) % lapLength;
        if (dDiff > trailLengthM) break;
        const p = toSvg(xs[idx], ys[idx]);
        trailPoints.push(p);
      }

      if (trailPoints.length > 1) {
        trailD = `M ${trailPoints[0].x.toFixed(1)} ${trailPoints[0].y.toFixed(1)}`;
        for (let k = 1; k < trailPoints.length; k++) {
          trailD += ` L ${trailPoints[k].x.toFixed(1)} ${trailPoints[k].y.toFixed(1)}`;
        }
      }
    }

    // 8. Driver Ghost Car Position & Telemetry
    let ghost: { x: number; y: number; speed: number; angle: number } | null = null;
    let ghostTrailD = '';
    let deltaS = 0;

    if (ghostModeEnabled && dists && dists.length > 0) {
      const ghostDist = (activeDistanceM * sessionStats.speedMultiplier) % lapLength;
      let ghostClosestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < dists.length; i++) {
        const diff = Math.abs(dists[i] - ghostDist);
        if (diff < minDiff) {
          minDiff = diff;
          ghostClosestIdx = i;
        }
      }

      const nextGhostIdx = (ghostClosestIdx + 1) % xs.length;
      const gCurSvg = toSvg(xs[ghostClosestIdx], ys[ghostClosestIdx]);
      const gNextSvg = toSvg(xs[nextGhostIdx], ys[nextGhostIdx]);
      const gAngle = Math.atan2(gNextSvg.y - gCurSvg.y, gNextSvg.x - gCurSvg.x) * (180 / Math.PI);

      ghost = {
        x: gCurSvg.x,
        y: gCurSvg.y,
        speed: (speeds[ghostClosestIdx] || 0) * sessionStats.speedMultiplier,
        angle: gAngle,
      };

      const gTrailPoints: { x: number; y: number }[] = [];
      const totalN = xs.length;
      for (let stepBack = 0; stepBack < 35; stepBack++) {
        const idx = (ghostClosestIdx - stepBack + totalN) % totalN;
        const dDiff = (ghostDist - dists[idx] + lapLength) % lapLength;
        if (dDiff > 260) break;
        const p = toSvg(xs[idx], ys[idx]);
        gTrailPoints.push(p);
      }
      if (gTrailPoints.length > 1) {
        ghostTrailD = `M ${gTrailPoints[0].x.toFixed(1)} ${gTrailPoints[0].y.toFixed(1)}`;
        for (let k = 1; k < gTrailPoints.length; k++) {
          ghostTrailD += ` L ${gTrailPoints[k].x.toFixed(1)} ${gTrailPoints[k].y.toFixed(1)}`;
        }
      }

      const simLapTime = simulation ? simulation.lapTime : circuit.poleLapTime;
      const progressFrac = activeDistanceM / lapLength;
      deltaS = (simLapTime - sessionStats.lapTime) * progressFrac;
    }

    // Speed Trap Coordinate Calculation
    let speedTrapCoord: { x: number; y: number; speed: number } | null = null;
    if (speeds && speeds.length > 0) {
      let maxSpd = 0;
      let maxIdx = 0;
      for (let i = 0; i < speeds.length; i++) {
        if (speeds[i] > maxSpd) {
          maxSpd = speeds[i];
          maxIdx = i;
        }
      }
      const stp = toSvg(xs[maxIdx], ys[maxIdx]);
      speedTrapCoord = { x: stp.x, y: stp.y, speed: Math.round(maxSpd) };
    }

    return {
      pathData: fullD,
      segmentsPath: segs,
      pitLanePath: pitPathD,
      startFinishLine: sfLine,
      cornerLabels: corners,
      drsSegments: drsLines,
      speedTrapCoord,
      carCoord: car,
      ghostCoord: ghost,
      carTrailPath: trailD,
      ghostTrailPath: ghostTrailD,
      currentMetrics: metrics,
      ghostDeltaS: deltaS,
      viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
      viewWidth: width,
      viewHeight: height,
    };
  }, [telemetry, lapLength, circuit, activeDistanceM, ghostModeEnabled, sessionStats, simulation]);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onHoverDistance) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * viewWidth;
      const clickY = ((e.clientY - rect.top) / rect.height) * viewHeight;

      const xs = telemetry.x;
      const ys = telemetry.y;
      const dists = telemetry.distance;
      if (!xs || xs.length === 0) return;

      let nearestDist = 0;
      let minDis = Infinity;
      for (let i = 0; i < xs.length; i++) {
        const sx = xs[i] - (viewWidth * 0.1);
        const sy = ys[i];
        const d = Math.hypot(clickX - sx, clickY - sy);
        if (d < minDis) {
          minDis = d;
          nearestDist = dists[i];
        }
      }
      onHoverDistance(nearestDist);
    },
    [onHoverDistance, telemetry, viewWidth, viewHeight]
  );

  return (
    <div className={`bg-[#0D0F13] border border-[#1E222B] rounded-[2px] flex flex-col overflow-hidden select-none font-mono ${className}`}>
      {/* 1. Engineering Command Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#1E222B] bg-[#0A0C10]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse inline-block" />
          <span className="text-xs font-bold tracking-wider text-white uppercase">
            TRACK MAP — {circuit.name.toUpperCase()} GP
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-[1px] bg-[#14171E] text-[#94A3B8] border border-[#1E222B] tabular">
            {Math.round(activeDistanceM).toLocaleString()}m / {Math.round(lapLength).toLocaleString()}m
          </span>
        </div>

        {/* View Mode Segmented Switch */}
        <div className="flex items-center bg-[#14171E] p-0.5 border border-[#1E222B] rounded-[2px]">
          {(['broadcast', 'elevation', 'heatmap', 'drs', 'sectors'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-2 py-0.5 rounded-[1px] text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                viewMode === mode
                  ? 'bg-[#1E2433] text-white border border-[#2D384D]'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {mode}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCorners(!showCorners)}
            className={`px-2 py-0.5 rounded-[1px] text-[10px] font-bold uppercase transition-colors border-l border-[#1E222B] cursor-pointer ${
              showCorners ? 'text-[#FFB300]' : 'text-[#475569]'
            }`}
            title="Toggle Turn Numbers"
          >
            TURNS
          </button>
        </div>
      </div>

      {/* 2. Driver & Session Selector Strip */}
      <div className="px-3 py-1.5 bg-[#0D0F13] border-b border-[#1E222B] flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Driver Selection Pills (All 20 participating drivers in classified grid order) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 max-w-full">
            <span className="text-[10px] font-bold text-[#64748B] uppercase pr-1 flex items-center gap-1 whitespace-nowrap">
              <Radio className="w-3 h-3 text-[#00E5FF]" strokeWidth={1.5} />
              GRID ({participants.length}):
            </span>
            {participants.map((p) => {
              const d = getDriver(p.driverId);
              const isSelected = selectedDriverId === d.id;
              const isPole = p.position === 1;
              return (
                <button
                  key={`${p.driverId}-${p.position}`}
                  type="button"
                  onClick={() => setSelectedDriverId(d.id)}
                  title={`${d.name} • ${d.team} • P${p.position} ${p.deltaToPole <= 0 ? '(POLE)' : `(+${p.deltaToPole.toFixed(3)}s)`}`}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[1px] text-[10px] font-bold uppercase transition-colors border cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'text-white border-current'
                      : 'bg-[#14171E] text-[#64748B] hover:text-white border-[#1E222B]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${d.teamColor}25` : undefined,
                    borderColor: isSelected ? d.teamColor : undefined,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: d.teamColor }}
                  />
                  <span className={`text-[8px] font-mono opacity-60 ${isPole ? 'text-[#FF2A54] font-black opacity-100' : ''}`}>
                    P{p.position}
                  </span>
                  <span>{d.code}</span>
                </button>
              );
            })}
          </div>

          {/* Ghost Mode Toggle */}
          <button
            type="button"
            onClick={() => setGhostModeEnabled(!ghostModeEnabled)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[1px] text-[10px] font-bold transition-colors border cursor-pointer ${
              ghostModeEnabled
                ? 'bg-[#00E676]/15 text-[#00E676] border-[#00E676]/40'
                : 'bg-[#14171E] text-[#64748B] border-[#1E222B]'
            }`}
          >
            <Activity className="w-3 h-3" strokeWidth={1.5} />
            <span>{ghostModeEnabled ? 'GHOST ON' : 'GHOST OFF'}</span>
          </button>
        </div>

        {/* Driver Session Details & Benchmark Readout */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-1">
            {SESSIONS_LIST.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSession(s.id)}
                className={`px-1.5 py-0.2 rounded-[1px] text-[10px] font-bold transition-colors cursor-pointer ${
                  selectedSession === s.id
                    ? 'bg-[#1E2433] text-white border border-[#2D384D]'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {s.label.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 text-[11px]">
            <span>
              <strong className="text-white font-bold tabular">{sessionStats.lapTimeStr}</strong>{' '}
              <span className={sessionStats.deltaToPole <= 0 ? 'text-[#00E676]' : 'text-[#FFB300]'}>
                ({sessionStats.deltaToPole <= 0 ? 'POLE' : `+${sessionStats.deltaToPole.toFixed(3)}s`})
              </span>
            </span>
            <span className="text-[#1E222B]">|</span>
            <span>
              SPEED TRAP: <strong className="text-[#00E5FF] tabular">{sessionStats.topSpeedKmh}</strong> km/h
            </span>
            <span className="text-[#1E222B]">|</span>
            <span className="text-[#64748B]">
              {sessionStats.compound.toUpperCase()} • {sessionStats.fuelKg}kg
            </span>
          </div>
        </div>
      </div>

      {/* 3. Full-Bleed Circuit Canvas with Coordinate Crosshair Grid */}
      <div className="relative w-full aspect-16/11 max-h-[460px] flex items-center justify-center overflow-hidden bg-[#07080A]">
        {/* Minimal North Compass Indicator */}
        <div className="absolute top-2 right-2 bg-[#0D0F13] border border-[#1E222B] rounded-[1px] px-1.5 py-0.5 z-10 text-[9px] pointer-events-none flex items-center gap-1 text-[#94A3B8]">
          <Compass className="w-3 h-3 text-[#00E5FF]" strokeWidth={1.5} />
          <span className="font-bold text-white">N</span>
        </div>

        {/* SVG Track Engine */}
        <svg
          viewBox={viewBox}
          className="w-full h-full cursor-crosshair transition-transform select-none"
          preserveAspectRatio="xMidYMid meet"
          onClick={handleTrackClick}
        >
          <defs>
            {/* Subtle Coordinate Crosshair Grid Pattern */}
            <pattern id="coordGrid" width="80" height="80" patternUnits="userSpaceOnUse">
              <line x1="0" y1="40" x2="80" y2="40" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
              <line x1="40" y1="0" x2="40" y2="80" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
              <path d="M 36 40 L 44 40 M 40 36 L 40 44" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
            </pattern>
          </defs>

          {/* Coordinate Crosshair Grid Background */}
          <rect width="100%" height="100%" fill="url(#coordGrid)" />

          {/* Outer Kerb / Runoff Silhouette */}
          <path
            d={pathData}
            fill="none"
            stroke="#121724"
            strokeWidth="28"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Solid Asphalt Roadway Ribbon */}
          <path
            d={pathData}
            fill="none"
            stroke="#1E2433"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inner Asphalt Texture Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#2A354A"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.4"
          />

          {/* Pit Lane Roadway */}
          {pitLanePath && (
            <g id="pitLane">
              <path
                d={pitLanePath}
                fill="none"
                stroke="#151A26"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pitLanePath}
                fill="none"
                stroke="#222C3E"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Start / Finish Line */}
          {startFinishLine && (
            <g id="startFinishLine">
              <line
                x1={startFinishLine.x1}
                y1={startFinishLine.y1}
                x2={startFinishLine.x2}
                y2={startFinishLine.y2}
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeDasharray="5 3"
                strokeLinecap="square"
              />
            </g>
          )}

          {/* Green DRS Zones Highlights Along Straights */}
          {drsSegments.map((drsD, i) => (
            <g key={`drs-${i}`}>
              <path
                d={drsD}
                fill="none"
                stroke="#00E676"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.9"
              />
            </g>
          ))}

          {/* 3D Elevation Gradient View */}
          {viewMode === 'elevation' &&
            segmentsPath.map((seg, idx) => (
              <path
                key={`elev-${idx}`}
                d={seg.d}
                fill="none"
                stroke={seg.elevColor || '#00E5FF'}
                strokeWidth="6"
                strokeLinecap="round"
                onMouseEnter={() => onHoverDistance && onHoverDistance(seg.dist)}
              />
            ))}

          {/* Sectors View */}
          {viewMode === 'sectors' &&
            segmentsPath.map((seg, idx) => (
              <path
                key={`sec-${idx}`}
                d={seg.d}
                fill="none"
                stroke={
                  seg.sector === 1
                    ? '#FFB300'
                    : seg.sector === 2
                    ? '#00E5FF'
                    : '#B829EA'
                }
                strokeWidth="6"
                strokeLinecap="round"
              />
            ))}

          {/* Speed Heatmap */}
          {viewMode === 'heatmap' &&
            segmentsPath.map((seg, idx) => (
              <path
                key={`spd-${idx}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth="6"
                strokeLinecap="round"
                onMouseEnter={() => onHoverDistance && onHoverDistance(seg.dist)}
              />
            ))}

          {/* Ghost Trailing Line */}
          {ghostModeEnabled && ghostTrailPath && (
            <path
              d={ghostTrailPath}
              fill="none"
              stroke="#FF2A54"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="4 3"
              strokeOpacity="0.5"
            />
          )}

          {/* SIM Player Trailing Line */}
          {carTrailPath && (
            <path
              d={carTrailPath}
              fill="none"
              stroke="#00E5FF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />
          )}

          {/* Speed Trap Marker Badge */}
          {speedTrapCoord && (
            <g transform={`translate(${speedTrapCoord.x}, ${speedTrapCoord.y})`}>
              <circle r="4" fill="#00E5FF" stroke="#FFFFFF" strokeWidth="1" />
              <g transform="translate(0, -14)">
                <rect
                  x="-18"
                  y="-7"
                  width="36"
                  height="14"
                  rx="1"
                  fill="#0D0F13"
                  stroke="#00E5FF"
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#00E5FF"
                  fontSize="7"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ST {speedTrapCoord.speed}
                </text>
              </g>
            </g>
          )}

          {/* Corner Apex Badges (T1, T2...) */}
          {showCorners &&
            cornerLabels.map((c) => (
              <g key={`corner-${c.number}`} transform={`translate(${c.x}, ${c.y})`}>
                <rect x="-8" y="-6" width="16" height="12" rx="1" fill="#0D0F13" stroke="#2D384D" strokeWidth="0.8" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#94A3B8"
                  fontSize="7"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  T{c.number}
                </text>
              </g>
            ))}

          {/* Live GHOST Position Marker */}
          {ghostModeEnabled && ghostCoord && (
            <g transform={`translate(${ghostCoord.x}, ${ghostCoord.y})`}>
              <circle
                r="6"
                fill="#FF2A54"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <g transform="translate(0, -14)">
                <rect
                  x="-18"
                  y="-6"
                  width="36"
                  height="12"
                  rx="1"
                  fill="#0D0F13"
                  stroke="#FF2A54"
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize="7"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  GHOST
                </text>
              </g>
            </g>
          )}

          {/* Live SIM Position Marker */}
          {carCoord && (
            <g transform={`translate(${carCoord.x}, ${carCoord.y})`}>
              <circle
                r="7"
                fill="#00E5FF"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <g transform="translate(0, -14)">
                <rect
                  x="-15"
                  y="-6"
                  width="30"
                  height="12"
                  rx="1"
                  fill="#0D0F13"
                  stroke="#00E5FF"
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#00E5FF"
                  fontSize="7.5"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  SIM
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* 4. Integrated Lower Telemetry Strip */}
      <div className="px-3 py-1.5 bg-[#0A0C10] border-t border-b border-[#1E222B] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-[#64748B]">SPD</span>
            <span className="text-white font-bold text-sm tabular leading-none">
              {currentMetrics.speed}
            </span>
            <span className="text-[10px] text-[#64748B]">km/h</span>
          </div>

          <div className="border-l border-[#1E222B] pl-2.5 flex items-baseline gap-1">
            <span className="text-[10px] text-[#64748B]">GEAR</span>
            <span className="text-[#00E5FF] font-bold text-sm leading-none">
              G{currentMetrics.gear}
            </span>
          </div>

          <div className="border-l border-[#1E222B] pl-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#64748B]">THR</span>
              <div className="w-10 h-2 bg-[#14171E] rounded-[1px] overflow-hidden border border-[#1E222B]">
                <div
                  className="h-full bg-[#00E676]"
                  style={{ width: `${currentMetrics.throttle}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#64748B]">BRK</span>
              <div className="w-8 h-2 bg-[#14171E] rounded-[1px] overflow-hidden border border-[#1E222B]">
                <div
                  className="h-full bg-[#FF2A54]"
                  style={{ width: `${currentMetrics.brake}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ghost Delta Status */}
        {ghostModeEnabled && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-[#64748B]">DELTA GHOST:</span>
            <span
              className={`font-bold text-[11px] px-1.5 py-0.2 rounded-[1px] tabular ${
                ghostDeltaS <= 0
                  ? 'text-[#00E676] bg-[#00E676]/15 border border-[#00E676]/40'
                  : 'text-[#FF2A54] bg-[#FF2A54]/15 border border-[#FF2A54]/40'
              }`}
            >
              {ghostDeltaS <= 0 ? '-' : '+'}
              {Math.abs(ghostDeltaS).toFixed(3)}s
            </span>
          </div>
        )}
      </div>

      {/* 5. Playback Controls & Scrubber */}
      <div className="px-3 py-2 bg-[#0D0F13] flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#64748B] w-12 tabular">
            {Math.round(activeDistanceM).toLocaleString()}m
          </span>
          <input
            type="range"
            min={0}
            max={Math.round(lapLength)}
            step={5}
            value={Math.round(activeDistanceM)}
            onChange={(e) => onHoverDistance && onHoverDistance(parseFloat(e.target.value))}
            className="flex-1 accent-[#00E5FF] cursor-pointer h-1 bg-[#14171E] rounded-[1px]"
          />
          <span className="text-[10px] text-[#64748B] w-12 text-right tabular">
            {Math.round(lapLength).toLocaleString()}m
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-xs font-bold transition-colors cursor-pointer ${
                isPlaying
                  ? 'bg-[#FF2A54] text-white'
                  : 'bg-[#14171E] hover:bg-[#1E2433] text-white border border-[#1E222B]'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3" /> PAUSE
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" /> PLAY
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onHoverDistance && onHoverDistance(0)}
              className="p-1 rounded-[2px] bg-[#14171E] text-[#94A3B8] hover:text-white border border-[#1E222B] transition-colors cursor-pointer"
              title="Reset to Start/Finish line"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            <div className="flex items-center bg-[#14171E] rounded-[2px] p-0.5 border border-[#1E222B]">
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.2 rounded-[1px] text-[10px] font-bold transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-[#1E2433] text-[#00E5FF] border border-[#2D384D]'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-[#64748B] hidden sm:block">
            {sessionStats.note}
          </div>
        </div>
      </div>
    </div>
  );
}
