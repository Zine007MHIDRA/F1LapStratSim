'use client';

import React, { useMemo } from 'react';
import { CircuitData } from '../engine/types';

interface TrackMapProps {
  circuit: CircuitData;
  activeDistanceM?: number;
  onHoverDistance?: (distM: number) => void;
  className?: string;
}

export default function TrackMap({
  circuit,
  activeDistanceM,
  onHoverDistance,
  className = '',
}: TrackMapProps) {
  const telemetry = circuit.telemetry;

  // Compute bounding box and normalizations for SVG projection
  const { pathData, segmentsPath, carCoord, viewBox } = useMemo(() => {
    const xs = telemetry.x;
    const ys = telemetry.y;
    const dists = telemetry.distance;
    const speeds = telemetry.speed;

    if (!xs || xs.length === 0) {
      return { pathData: '', segmentsPath: [], carCoord: null, viewBox: '0 0 1000 1000' };
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
      // Invert Y for standard screen coordinates
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
      // Speed coloring: <130 red, 130-240 yellow/orange, >240 cyan
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

    // Locate active vehicle position if distance provided
    let car: { x: number; y: number; speed: number } | null = null;
    if (activeDistanceM !== undefined && dists.length > 0) {
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
    }

    return {
      pathData: fullD,
      segmentsPath: segs,
      carCoord: car,
      viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
    };
  }, [telemetry, activeDistanceM]);

  return (
    <div className={`relative bg-[#0E131F] border border-[#212A3E] rounded-lg p-4 flex flex-col ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase">
            GPS RACING LINE ({circuit.name})
          </span>
          <span className="text-[10px] mono px-2 py-0.5 rounded bg-[#141A29] text-[#64748B] border border-[#212A3E]">
            {circuit.lapLengthM}m
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] mono">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E10600]"></span>
            <span className="text-[#94A3B8]">&lt;130 km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFB703]"></span>
            <span className="text-[#94A3B8]">130-220</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00F0FF]"></span>
            <span className="text-[#94A3B8]">&gt;280 km/h</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full aspect-4/3 max-h-[460px] flex items-center justify-center overflow-hidden">
        <svg
          viewBox={viewBox}
          className="w-full h-full cursor-crosshair transition-transform"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background track silhouette / glow */}
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
              <circle r="12" fill="#00F0FF" fillOpacity="0.25" />
              <circle r="6" fill="#00F0FF" stroke="#FFFFFF" strokeWidth="2" />
              <text
                x="14"
                y="4"
                fill="#FFFFFF"
                fontSize="24"
                fontFamily="monospace"
                fontWeight="bold"
                className="select-none"
              >
                {Math.round(carCoord.speed)} km/h
              </text>
            </g>
          )}

          {/* Start/Finish line indicator (point 0) */}
          {segmentsPath.length > 0 && (
            <circle
              cx={telemetry.x[0] ? (telemetry.x[0] - parseFloat(viewBox.split(' ')[0])) : 0}
              cy={telemetry.y[0] ? (parseFloat(viewBox.split(' ')[3]) - telemetry.y[0]) : 0}
              r="4"
              fill="#FFFFFF"
              stroke="#E10600"
              strokeWidth="2"
            />
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
