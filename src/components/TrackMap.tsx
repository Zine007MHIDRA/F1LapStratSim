'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CircuitData } from '../engine/types';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';

interface TrackMapProps {
  circuit: CircuitData;
  activeDistanceM?: number;
  onHoverDistance?: (distM: number) => void;
  className?: string;
}

export default function TrackMap({
  circuit,
  activeDistanceM = 0,
  onHoverDistance,
  className = '',
}: TrackMapProps) {
  const telemetry = circuit.telemetry;
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 2x default for smooth preview
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const lapLength = circuit.lapLengthM || 5000;

  // Real-time animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000.0;
      lastTimeRef.current = time;

      // Approximate car velocity at current position (~240 km/h = 66 m/s)
      const currentSpeedMps = 70.0;
      const deltaM = currentSpeedMps * dt * playbackSpeed;
      const nextDist = ((activeDistanceM ?? 0) + deltaM) % lapLength;

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
  }, [isPlaying, activeDistanceM, lapLength, playbackSpeed, onHoverDistance]);

  // Compute bounding box and normalizations for SVG projection
  const { pathData, segmentsPath, carCoord, currentMetrics, viewBox } = useMemo(() => {
    const xs = telemetry.x;
    const ys = telemetry.y;
    const dists = telemetry.distance;
    const speeds = telemetry.speed;

    if (!xs || xs.length === 0) {
      return {
        pathData: '',
        segmentsPath: [],
        carCoord: null,
        currentMetrics: { speed: 0, gear: 1, throttle: 0, brake: 0 },
        viewBox: '0 0 1000 1000',
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i];
      if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i];
      if (ys[i] > maxY) maxY = ys[i];
    }

    const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
    const width = maxX - minX + 2 * pad;
    const height = maxY - minY + 2 * pad;
    const offsetX = minX - pad;
    const offsetY = minY - pad;

    // Build multi-colored line segments based on vehicle speed
    const segs: { d: string; color: string; speed: number; dist: number }[] = [];
    let fullD = '';

    for (let i = 0; i < xs.length; i++) {
      const nextIdx = (i + 1) % xs.length;
      const x1 = xs[i] - offsetX;
      const y1 = maxY + pad - ys[i];
      const x2 = xs[nextIdx] - offsetX;
      const y2 = maxY + pad - ys[nextIdx];

      if (i === 0) {
        fullD += `M ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      } else {
        fullD += ` L ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }

      const spd = speeds[i] || 200;
      let color = '#00F0FF';
      if (spd < 130) {
        color = '#E10600';
      } else if (spd < 220) {
        color = '#FFB703';
      } else if (spd < 280) {
        color = '#00E676';
      }

      segs.push({
        d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        color,
        speed: spd,
        dist: dists[i],
      });
    }
    fullD += ' Z';

    // Locate active vehicle position
    let car: { x: number; y: number; speed: number } | null = null;
    let metrics = { speed: 0, gear: 1, throttle: 0, brake: 0 };

    if (dists && dists.length > 0) {
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < dists.length; i++) {
        const diff = Math.abs(dists[i] - activeDistanceM);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      car = {
        x: xs[closestIdx] - offsetX,
        y: maxY + pad - ys[closestIdx],
        speed: speeds[closestIdx] || 0,
      };
      metrics = {
        speed: Math.round(speeds[closestIdx] || 0),
        gear: telemetry.gear[closestIdx] || 1,
        throttle: telemetry.throttle ? Math.round(telemetry.throttle[closestIdx] || 0) : 0,
        brake: telemetry.brake ? Math.round(telemetry.brake[closestIdx] || 0) : 0,
      };
    }

    return {
      pathData: fullD,
      segmentsPath: segs,
      carCoord: car,
      currentMetrics: metrics,
      viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
    };
  }, [telemetry, activeDistanceM]);

  return (
    <div className={`relative bg-[#0E131F] border border-[#212A3E] rounded-lg p-4 flex flex-col ${className}`}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase">
            GPS RACING LINE ({circuit.name})
          </span>
          <span className="text-[10px] mono px-2 py-0.5 rounded bg-[#141A29] text-[#00F0FF] border border-[#212A3E]">
            {Math.round(activeDistanceM)}m / {lapLength}m
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${
              isPlaying
                ? 'bg-[#E10600] text-white shadow-sm'
                : 'bg-[#141A29] text-[#00F0FF] border border-[#212A3E] hover:bg-[#1E2638]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3" /> PAUSE
              </>
            ) : (
              <>
                <Play className="w-3 h-3" /> REPLAY
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onHoverDistance && onHoverDistance(0)}
            className="p-1 rounded bg-[#141A29] text-[#94A3B8] hover:text-white border border-[#212A3E]"
            title="Reset to Start/Finish line"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Multiplier Pill */}
          <button
            type="button"
            onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 4 : 1)}
            className="px-2 py-1 rounded text-[10px] mono bg-[#141A29] text-[#FFB703] border border-[#212A3E] hover:border-[#334155] font-bold"
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>

      {/* SVG Canvas with Live HUD Overlay */}
      <div className="relative w-full aspect-4/3 max-h-[460px] flex items-center justify-center overflow-hidden">
        {/* Live Cockpit HUD Overlay */}
        <div className="absolute top-3 left-3 bg-[#080A0F]/85 border border-[#212A3E] rounded p-2.5 z-10 mono text-xs pointer-events-none backdrop-blur-xs flex items-center gap-4">
          <div>
            <span className="text-[#64748B] text-[9px] block">SPEED</span>
            <span className="text-white font-bold text-base leading-tight">
              {currentMetrics.speed} <span className="text-[10px] text-[#94A3B8]">km/h</span>
            </span>
          </div>
          <div className="border-l border-[#212A3E] pl-3">
            <span className="text-[#64748B] text-[9px] block">GEAR</span>
            <span className="text-[#00F0FF] font-bold text-base leading-tight">
              G{currentMetrics.gear}
            </span>
          </div>
          <div className="border-l border-[#212A3E] pl-3 flex items-center gap-2">
            <div className="text-center">
              <span className="text-[9px] text-[#64748B] block">THR</span>
              <div className="w-3 h-8 bg-[#141A29] rounded overflow-hidden flex flex-col justify-end border border-[#212A3E]">
                <div
                  className="w-full bg-[#00E676] transition-all"
                  style={{ height: `${currentMetrics.throttle}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-[#64748B] block">BRK</span>
              <div className="w-3 h-8 bg-[#141A29] rounded overflow-hidden flex flex-col justify-end border border-[#212A3E]">
                <div
                  className="w-full bg-[#E10600] transition-all"
                  style={{ height: `${currentMetrics.brake}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <svg
          viewBox={viewBox}
          className="w-full h-full cursor-crosshair transition-transform"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background track silhouette */}
          <path
            d={pathData}
            fill="none"
            stroke="#141A29"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pathData}
            fill="none"
            stroke="#212A3E"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Color-mapped speed racing line */}
          {segmentsPath.map((seg, idx) => (
            <path
              key={idx}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth="5"
              strokeLinecap="round"
              className="hover:stroke-white transition-colors"
              onMouseEnter={() => onHoverDistance && onHoverDistance(seg.dist)}
            />
          ))}

          {/* Active vehicle indicator */}
          {carCoord && (
            <g transform={`translate(${carCoord.x}, ${carCoord.y})`}>
              <circle r="14" fill="#00F0FF" fillOpacity="0.25" />
              <circle r="6" fill="#00F0FF" stroke="#FFFFFF" strokeWidth="2" />
            </g>
          )}
        </svg>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-[#94A3B8] border-t border-[#212A3E] pt-2 mt-2">
        <span>Direction: <strong className="text-white">{circuit.direction}</strong></span>
        <span>DRS Zones: <strong className="text-[#00F0FF]">{circuit.drsZoneCount}</strong></span>
        <span>Turns: <strong className="text-white">{circuit.segments.filter(s => s.kind === 'corner').length}</strong></span>
      </div>
    </div>
  );
}
