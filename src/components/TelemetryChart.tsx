'use client';

import React, { useState, useMemo } from 'react';
import { CircuitData, LapSimulationResult } from '../engine/types';

interface TelemetryChartProps {
  circuit: CircuitData;
  simulation: LapSimulationResult;
  hoverDistanceM: number;
  onHoverDistance: (distM: number) => void;
}

export default function TelemetryChart({
  circuit,
  simulation,
  hoverDistanceM,
  onHoverDistance,
}: TelemetryChartProps) {
  const [activeChannel, setActiveChannel] = useState<'all' | 'speed' | 'pedals' | 'gforce' | 'ers'>('all');

  const realTel = circuit.telemetry;
  const simDist = simulation.distance;
  const simSpeed = simulation.speedKmh;
  const maxDist = circuit.lapLengthM;

  // Find nearest data points for the scrub crosshair
  const activeMetrics = useMemo(() => {
    let realIdx = 0;
    if (realTel.distance && realTel.distance.length > 0) {
      let minDiff = Infinity;
      for (let i = 0; i < realTel.distance.length; i++) {
        const diff = Math.abs(realTel.distance[i] - hoverDistanceM);
        if (diff < minDiff) {
          minDiff = diff;
          realIdx = i;
        }
      }
    }

    let simIdx = 0;
    if (simDist && simDist.length > 0) {
      let minDiff = Infinity;
      for (let i = 0; i < simDist.length; i++) {
        const diff = Math.abs(simDist[i] - hoverDistanceM);
        if (diff < minDiff) {
          minDiff = diff;
          simIdx = i;
        }
      }
    }

    return {
      distance: Math.round(hoverDistanceM),
      realSpeed: Math.round(realTel.speed[realIdx] || 0),
      simSpeed: Math.round(simSpeed[simIdx] || 0),
      simFreeSpeed: Math.round(simulation.speedFreeKmh[simIdx] || 0),
      throttle: Math.round(simulation.throttlePct[simIdx] || 0),
      brake: Math.round(simulation.brakePct[simIdx] || 0),
      gear: simulation.gear[simIdx] || 1,
      gLat: (simulation.gLat[simIdx] || 0).toFixed(2),
      gLong: (simulation.gLong[simIdx] || 0).toFixed(2),
      socMJ: ((simulation.ers.socTrace[simIdx] || 0) / 1e6).toFixed(2),
    };
  }, [hoverDistanceM, realTel, simDist, simSpeed, simulation]);

  // SVG dimensions
  const svgWidth = 1000;
  const speedH = 180;
  const pedalsH = 90;
  const gforceH = 90;
  const ersH = 90;

  // Scale functions
  const scaleX = (d: number) => (d / maxDist) * svgWidth;
  const scaleSpeedY = (v: number) => speedH - (v / 380) * speedH;
  const scalePctY = (p: number) => pedalsH - (p / 100) * pedalsH;
  const scaleGY = (g: number) => gforceH / 2 - (g / 6.0) * (gforceH / 2);
  const scaleSocY = (socJ: number) => ersH - (socJ / 5.4e6) * ersH;

  // Build SVG polyline paths
  const realSpeedPath = useMemo(() => {
    if (!realTel.distance || realTel.distance.length === 0) return '';
    return realTel.distance
      .map((d, i) => `${scaleX(d).toFixed(1)},${scaleSpeedY(realTel.speed[i]).toFixed(1)}`)
      .join(' ');
  }, [realTel, maxDist]);

  const simSpeedPath = useMemo(() => {
    return simDist
      .map((d, i) => `${scaleX(d).toFixed(1)},${scaleSpeedY(simSpeed[i]).toFixed(1)}`)
      .join(' ');
  }, [simDist, simSpeed, maxDist]);

  const throttlePath = useMemo(() => {
    return simDist
      .map((d, i) => `${scaleX(d).toFixed(1)},${scalePctY(simulation.throttlePct[i]).toFixed(1)}`)
      .join(' ');
  }, [simDist, simulation.throttlePct, maxDist]);

  const brakePath = useMemo(() => {
    return simDist
      .map((d, i) => `${scaleX(d).toFixed(1)},${scalePctY(simulation.brakePct[i]).toFixed(1)}`)
      .join(' ');
  }, [simDist, simulation.brakePct, maxDist]);

  const socPath = useMemo(() => {
    return simDist
      .map((d, i) => `${scaleX(d).toFixed(1)},${scaleSocY(simulation.ers.socTrace[i]).toFixed(1)}`)
      .join(' ');
  }, [simDist, simulation.ers.socTrace, maxDist]);

  const crosshairX = scaleX(hoverDistanceM);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const distM = (x / rect.width) * maxDist;
    onHoverDistance(distM);
  };

  return (
    <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-4 flex flex-col gap-3">
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#212A3E] pb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase">
            LIVE TELEMETRY TRACE
          </span>
          <div className="flex items-center gap-4 text-xs mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#00F0FF]"></span>
              <span className="text-[#00F0FF]">SIM SPEED ({activeMetrics.simSpeed} km/h)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#E10600]"></span>
              <span className="text-[#E10600]">FASTF1 POLE ({activeMetrics.realSpeed} km/h)</span>
            </div>
          </div>
        </div>

        {/* Channel Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          {(['all', 'speed', 'pedals', 'gforce', 'ers'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-colors ${
                activeChannel === ch
                  ? 'bg-[#E10600] text-white font-bold'
                  : 'bg-[#141A29] text-[#94A3B8] hover:text-white'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Instantaneous Cursor Readouts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 bg-[#141A29] p-2.5 rounded border border-[#212A3E] text-xs mono">
        <div>
          <span className="text-[#64748B] block text-[10px]">DISTANCE</span>
          <span className="text-white font-bold">{activeMetrics.distance} m</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[10px]">THROTTLE</span>
          <span className="text-[#00E676] font-bold">{activeMetrics.throttle}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[10px]">BRAKE</span>
          <span className="text-[#E10600] font-bold">{activeMetrics.brake}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[10px]">GEAR</span>
          <span className="text-white font-bold">G{activeMetrics.gear}</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[10px]">LAT G</span>
          <span className="text-[#FFB703] font-bold">{activeMetrics.gLat} g</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[10px]">LONG G</span>
          <span className="text-[#00F0FF] font-bold">{activeMetrics.gLong} g</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[10px]">ERS SOC</span>
          <span className="text-[#FF7A00] font-bold">{activeMetrics.socMJ} MJ</span>
        </div>
      </div>

      {/* SVG Multi-Channel Telemetry Graph */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${
            activeChannel === 'all'
              ? speedH + pedalsH + gforceH + ersH + 60
              : activeChannel === 'speed'
              ? speedH + 30
              : 140
          }`}
          className="w-full h-auto cursor-crosshair"
          onMouseMove={handleMouseMove}
        >
          {/* Grid lines */}
          <line x1="0" y1="0" x2={svgWidth} y2="0" stroke="#212A3E" strokeWidth="1" />
          <line x1="0" y1={speedH} x2={svgWidth} y2={speedH} stroke="#212A3E" strokeWidth="1" />

          {/* Sector division vertical lines */}
          {simulation.sectorBoundsM && (
            <>
              <line
                x1={scaleX(simulation.sectorBoundsM[0])}
                y1="0"
                x2={scaleX(simulation.sectorBoundsM[0])}
                y2="500"
                stroke="#FFB703"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.4"
              />
              <line
                x1={scaleX(simulation.sectorBoundsM[1])}
                y1="0"
                x2={scaleX(simulation.sectorBoundsM[1])}
                y2="500"
                stroke="#FFB703"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.4"
              />
            </>
          )}

          {/* 1. SPEED CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'speed') && (
            <g>
              {/* Y-axis labels */}
              <text x="6" y="20" fill="#64748B" fontSize="10" fontFamily="monospace">
                350 km/h
              </text>
              <text x="6" y={speedH / 2} fill="#64748B" fontSize="10" fontFamily="monospace">
                200 km/h
              </text>
              <text x="6" y={speedH - 6} fill="#64748B" fontSize="10" fontFamily="monospace">
                50 km/h
              </text>

              {/* FastF1 Real Pole Trace */}
              <polyline
                fill="none"
                stroke="#E10600"
                strokeWidth="2.5"
                strokeOpacity="0.85"
                points={realSpeedPath}
              />

              {/* Physics Simulation Speed Trace */}
              <polyline
                fill="none"
                stroke="#00F0FF"
                strokeWidth="2.0"
                points={simSpeedPath}
              />
            </g>
          )}

          {/* 2. THROTTLE & BRAKE CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'pedals') && (
            <g transform={`translate(0, ${speedH + 15})`}>
              <line x1="0" y1={pedalsH} x2={svgWidth} y2={pedalsH} stroke="#212A3E" strokeWidth="1" />
              <text x="6" y="14" fill="#64748B" fontSize="9" fontFamily="monospace">
                PEDALS 100%
              </text>
              <polyline fill="none" stroke="#00E676" strokeWidth="1.8" points={throttlePath} />
              <polyline fill="none" stroke="#E10600" strokeWidth="1.8" points={brakePath} />
            </g>
          )}

          {/* 3. ERS BATTERY SOC & CLIPPING */}
          {(activeChannel === 'all' || activeChannel === 'ers') && (
            <g transform={`translate(0, ${speedH + pedalsH + 30})`}>
              <line x1="0" y1={ersH} x2={svgWidth} y2={ersH} stroke="#212A3E" strokeWidth="1" />
              <text x="6" y="14" fill="#64748B" fontSize="9" fontFamily="monospace">
                ERS BATTERY STORE (MJ)
              </text>
              <polyline fill="none" stroke="#FF7A00" strokeWidth="1.8" points={socPath} />
            </g>
          )}

          {/* Interactive Scrub Crosshair */}
          <line
            x1={crosshairX}
            y1="0"
            x2={crosshairX}
            y2="600"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>
      </div>

      {/* Telemetry Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs text-[#94A3B8] border-t border-[#212A3E] pt-2">
        <div className="flex items-center gap-4">
          <span>Speed Trap: <strong className="text-white">{simulation.speedTrapKmh.toFixed(1)} km/h</strong></span>
          <span>S1: <strong className="text-[#FFB703]">{simulation.sectorTimes[0].toFixed(3)}s</strong></span>
          <span>S2: <strong className="text-[#FFB703]">{simulation.sectorTimes[1].toFixed(3)}s</strong></span>
          <span>S3: <strong className="text-[#FFB703]">{simulation.sectorTimes[2].toFixed(3)}s</strong></span>
        </div>
        <div>
          <span>ERS Clipped Distance: <strong className="text-[#FF7A00]">{simulation.ers.clipDistanceM.toFixed(0)}m</strong></span>
        </div>
      </div>
    </div>
  );
}
