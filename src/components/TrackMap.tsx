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
import {
  Play,
  Pause,
  RotateCcw,
  Radio,
  Sparkles,
  Compass,
} from 'lucide-react';

interface TrackMapProps {
  circuit: CircuitData;
  activeDistanceM?: number;
  onHoverDistance?: (distM: number) => void;
  simulation?: LapSimulationResult;
  className?: string;
}

export type TrackViewMode = 'broadcast' | 'heatmap' | 'drs' | 'sectors';

export default function TrackMap({
  circuit,
  activeDistanceM = 0,
  onHoverDistance,
  simulation,
  className = '',
}: TrackMapProps) {
  const telemetry = circuit.telemetry;
  const lapLength = circuit.lapLengthM || 5000;

  // Driver & Session selection state
  const [selectedDriverId, setSelectedDriverId] = useState<string>(circuit.poleDriver?.toLowerCase() || 'nor');
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
      selectedSession
    );
  }, [circuit, selectedDriverId, selectedSession]);

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
    const segs: { d: string; color: string; speed: number; dist: number; sector: number }[] = [];
    const s1Cut = lapLength * circuit.sectorFractions[0];
    const s2Cut = lapLength * circuit.sectorFractions[1];

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
      if (spd < 130) spdColor = '#E10600';
      else if (spd < 220) spdColor = '#FFB703';
      else if (spd < 280) spdColor = '#00E676';

      const sector = dist < s1Cut ? 1 : dist < s2Cut ? 2 : 3;

      segs.push({
        d: `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
        color: spdColor,
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

    return {
      pathData: fullD,
      segmentsPath: segs,
      pitLanePath: pitPathD,
      startFinishLine: sfLine,
      cornerLabels: corners,
      drsSegments: drsLines,
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
    <div className={`bg-[#0B0F19] border border-[#1A2336] rounded-xl flex flex-col shadow-2xl overflow-hidden ${className}`}>
      {/* 1. Sleek Command Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#1A2336]/80 bg-[#0E1321]">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse shadow-[0_0_8px_#00E676]" />
          <span className="text-xs font-black tracking-wider text-white uppercase mono">
            CIRCUIT TELEMETRY // {circuit.name.toUpperCase()}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#151C2C] text-[#94A3B8] border border-[#212E44] mono">
            {Math.round(activeDistanceM)}m / {lapLength}m
          </span>
        </div>

        {/* View Mode Segmented Switch */}
        <div className="flex items-center bg-[#07090E] p-0.5 rounded-lg border border-[#1A2336]">
          {(['broadcast', 'heatmap', 'drs', 'sectors'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all mono ${
                viewMode === mode
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {mode}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCorners(!showCorners)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all mono border-l border-[#1A2336] ${
              showCorners ? 'text-[#FFB703]' : 'text-[#475569]'
            }`}
            title="Toggle Turn Numbers"
          >
            Turns
          </button>
        </div>
      </div>

      {/* 2. Driver & Session Selector Strip */}
      <div className="px-4 py-2.5 bg-[#080B12] border-b border-[#1A2336]/60 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Driver Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[10px] mono font-bold text-[#64748B] uppercase pr-1 flex items-center gap-1">
              <Radio className="w-3 h-3 text-[#FF8000]" />
              DRIVER:
            </span>
            {DRIVERS.map((d) => {
              const isSelected = selectedDriverId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDriverId(d.id)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold mono uppercase transition-all ${
                    isSelected
                      ? 'text-white shadow-xs border'
                      : 'bg-[#101524] text-[#94A3B8] hover:text-white border border-[#1A2336]'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${d.teamColor}20` : undefined,
                    borderColor: isSelected ? d.teamColor : undefined,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: d.teamColor }}
                  />
                  <span>{d.code}</span>
                </button>
              );
            })}
          </div>

          {/* Ghost Mode Toggle */}
          <button
            type="button"
            onClick={() => setGhostModeEnabled(!ghostModeEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold mono transition-all border ${
              ghostModeEnabled
                ? 'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30'
                : 'bg-[#101524] text-[#64748B] border-[#1A2336]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {ghostModeEnabled ? 'GHOST ON' : 'GHOST OFF'}
          </button>
        </div>

        {/* Driver Session Details & Benchmark Readout */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 text-xs mono text-[#94A3B8]">
          <div className="flex items-center gap-1">
            {SESSIONS_LIST.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSession(s.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                  selectedSession === s.id
                    ? 'bg-[#1E293B] text-white'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {s.label.split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span>
              <strong className="text-white font-bold">{sessionStats.lapTimeStr}</strong>{' '}
              <span className={sessionStats.deltaToPole <= 0 ? 'text-[#00E676]' : 'text-[#FFB703]'}>
                ({sessionStats.deltaToPole <= 0 ? 'POLE' : `+${sessionStats.deltaToPole.toFixed(3)}s`})
              </span>
            </span>
            <span className="text-[#1A2336]">|</span>
            <span>
              SPEED TRAP: <strong className="text-[#00F0FF]">{sessionStats.topSpeedKmh}</strong> km/h
            </span>
            <span className="text-[#1A2336]">|</span>
            <span className="text-[#64748B]">
              {sessionStats.compound.toUpperCase()} • {sessionStats.fuelKg}kg
            </span>
          </div>
        </div>
      </div>

      {/* 3. Full-Bleed Circuit Canvas (No Obstructing Boxes!) */}
      <div className="relative w-full aspect-16/11 max-h-[460px] flex items-center justify-center overflow-hidden bg-[#05070B]">
        {/* Subtle CAD Radar Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '36px 36px',
          }}
        />

        {/* Minimal North Compass Indicator */}
        <div className="absolute top-3 right-3 bg-[#0B0F19]/80 border border-[#1A2336] rounded px-2 py-0.5 z-10 mono text-[9px] pointer-events-none flex items-center gap-1 text-[#94A3B8]">
          <Compass className="w-3 h-3 text-[#00F0FF]" />
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
            <linearGradient id="carTrailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={activeDriver.teamColor} stopOpacity="0.0" />
              <stop offset="100%" stopColor={activeDriver.teamColor} stopOpacity="0.9" />
            </linearGradient>
            <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer Kerb / Runoff Silhouette */}
          <path
            d={pathData}
            fill="none"
            stroke="#121724"
            strokeWidth="32"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Wide Solid Asphalt Roadway Ribbon */}
          <path
            d={pathData}
            fill="none"
            stroke="#2E384D"
            strokeWidth="22"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inner Asphalt Texture Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#39455E"
            strokeWidth="14"
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
                stroke="#1E2536"
                strokeWidth="15"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pitLanePath}
                fill="none"
                stroke="#2A354A"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pitLanePath}
                fill="none"
                stroke="#475569"
                strokeWidth="1.5"
                strokeDasharray="6 5"
                strokeOpacity="0.6"
              />
            </g>
          )}

          {/* Start / Finish Line (//) */}
          {startFinishLine && (
            <g id="startFinishLine">
              <line
                x1={startFinishLine.x1}
                y1={startFinishLine.y1}
                x2={startFinishLine.x2}
                y2={startFinishLine.y2}
                stroke="#FFFFFF"
                strokeWidth="3.5"
                strokeDasharray="6 3"
                strokeLinecap="square"
              />
            </g>
          )}

          {/* DRS Zones */}
          {viewMode === 'drs' &&
            drsSegments.map((drsD, i) => (
              <path
                key={`drs-${i}`}
                d={drsD}
                fill="none"
                stroke="#00E676"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-pulse"
                strokeOpacity="0.85"
              />
            ))}

          {/* Sectors */}
          {viewMode === 'sectors' &&
            segmentsPath.map((seg, idx) => (
              <path
                key={`sec-${idx}`}
                d={seg.d}
                fill="none"
                stroke={
                  seg.sector === 1
                    ? '#FFB703'
                    : seg.sector === 2
                    ? '#00F0FF'
                    : '#D946EF'
                }
                strokeWidth="8"
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
                className="hover:stroke-white transition-colors"
                onMouseEnter={() => onHoverDistance && onHoverDistance(seg.dist)}
              />
            ))}

          {/* Ghost Trailing Line */}
          {ghostModeEnabled && ghostTrailPath && (
            <path
              d={ghostTrailPath}
              fill="none"
              stroke={activeDriver.teamColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="6 4"
              strokeOpacity="0.4"
            />
          )}

          {/* Player Trailing Line */}
          {carTrailPath && (
            <path
              d={carTrailPath}
              fill="none"
              stroke={activeDriver.teamColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeOpacity="0.9"
            />
          )}

          {/* Corner Apex Badges (T1, T2...) */}
          {showCorners &&
            cornerLabels.map((c) => (
              <g key={`corner-${c.number}`} transform={`translate(${c.x}, ${c.y})`}>
                <circle r="8" fill="#0C121E" stroke="#2A3854" strokeWidth="1" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#94A3B8"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  T{c.number}
                </text>
              </g>
            ))}

          {/* Ghost Car Beacon */}
          {ghostModeEnabled && ghostCoord && (
            <g transform={`translate(${ghostCoord.x}, ${ghostCoord.y})`}>
              <circle
                r="16"
                fill={activeDriver.teamColor}
                fillOpacity="0.10"
                stroke={activeDriver.teamColor}
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <circle
                r="6.5"
                fill={activeDriver.teamColor}
                fillOpacity="0.6"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
              <g transform="translate(0, -18)">
                <rect
                  x="-22"
                  y="-9"
                  width="44"
                  height="13"
                  rx="2"
                  fill="#080B12"
                  fillOpacity="0.85"
                  stroke={activeDriver.teamColor}
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize="7.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {activeDriver.code}
                </text>
              </g>
            </g>
          )}

          {/* Active Car Marker & NOR Tag */}
          {carCoord && (
            <g transform={`translate(${carCoord.x}, ${carCoord.y})`}>
              <circle
                r="15"
                fill={activeDriver.teamColor}
                fillOpacity="0.25"
                filter="url(#beaconGlow)"
              />
              <circle
                r="8"
                fill={activeDriver.teamColor}
                stroke="#FFFFFF"
                strokeWidth="2.5"
              />
              <g transform="translate(0, -17)">
                <rect
                  x="-16"
                  y="-9"
                  width="32"
                  height="14"
                  rx="2.5"
                  fill="#080B12"
                  fillOpacity="0.92"
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FFFFFF"
                  fontSize="8.5"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  {activeDriver.code}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* 4. Integrated Lower Telemetry Strip (Replaces the Clunky Old Floating HUD!) */}
      <div className="px-4 py-2 bg-[#0E1321] border-t border-b border-[#1A2336] flex flex-wrap items-center justify-between gap-3 text-xs mono">
        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-[#64748B] font-bold">SPEED</span>
            <span className="text-white font-black text-base tabular leading-none">
              {currentMetrics.speed}
            </span>
            <span className="text-[10px] text-[#64748B]">km/h</span>
          </div>

          <div className="border-l border-[#1A2336] pl-3 flex items-baseline gap-1.5">
            <span className="text-[10px] text-[#64748B] font-bold">GEAR</span>
            <span className="text-[#00F0FF] font-black text-base leading-none">
              G{currentMetrics.gear}
            </span>
          </div>

          <div className="border-l border-[#1A2336] pl-3 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#64748B] font-bold">THR</span>
              <div className="w-12 h-2.5 bg-[#141B2A] rounded-xs overflow-hidden border border-[#1A2336]">
                <div
                  className="h-full bg-[#00E676] transition-all duration-75"
                  style={{ width: `${currentMetrics.throttle}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-[#64748B] font-bold">BRK</span>
              <div className="w-8 h-2.5 bg-[#141B2A] rounded-xs overflow-hidden border border-[#1A2336]">
                <div
                  className="h-full bg-[#E10600] transition-all duration-75"
                  style={{ width: `${currentMetrics.brake}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ghost Delta Status */}
        {ghostModeEnabled && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#64748B] font-bold">VS GHOST ({activeDriver.code}):</span>
            <span
              className={`font-black text-xs px-2 py-0.5 rounded ${
                ghostDeltaS <= 0
                  ? 'text-[#00E676] bg-[#00E676]/15 border border-[#00E676]/30'
                  : 'text-[#E10600] bg-[#E10600]/15 border border-[#E10600]/30'
              }`}
            >
              {ghostDeltaS <= 0 ? '▲ -' : '▼ +'}
              {Math.abs(ghostDeltaS).toFixed(3)}s
            </span>
          </div>
        )}
      </div>

      {/* 5. Playback Controls & Scrubber */}
      <div className="px-4 py-2.5 bg-[#080B12] flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] mono text-[#64748B] w-12 tabular">
            {Math.round(activeDistanceM)}m
          </span>
          <input
            type="range"
            min={0}
            max={lapLength}
            step={5}
            value={Math.round(activeDistanceM)}
            onChange={(e) => onHoverDistance && onHoverDistance(parseFloat(e.target.value))}
            className="flex-1 accent-[#FF8000] cursor-pointer h-1 bg-[#1A2336] rounded-lg"
          />
          <span className="text-[10px] mono text-[#64748B] w-12 text-right tabular">
            {lapLength}m
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black mono transition-all shadow-xs ${
                isPlaying
                  ? 'bg-[#E10600] text-white'
                  : 'bg-[#FF8000] text-black hover:bg-[#FFA033]'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> PAUSE
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> PLAY REPLAY
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onHoverDistance && onHoverDistance(0)}
              className="p-1 rounded bg-[#101524] text-[#94A3B8] hover:text-white border border-[#1A2336] transition-colors"
              title="Reset to Start/Finish line"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center bg-[#101524] rounded p-0.5 border border-[#1A2336]">
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded text-[10px] mono font-bold transition-all ${
                    playbackSpeed === spd
                      ? 'bg-[#1E293B] text-[#FFB703]'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] mono text-[#64748B] hidden sm:block">
            {sessionStats.note}
          </div>
        </div>
      </div>
    </div>
  );
}
