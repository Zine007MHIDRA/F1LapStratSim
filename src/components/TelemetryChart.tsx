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

  // Nearest data point lookups for cursor scrubber
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

    const gLatVal = simulation.gLat[simIdx] || 0;
    const throttleVal = simulation.throttlePct[simIdx] || 0;
    const speedVal = simSpeed[simIdx] || 0;
    // 2026 Active Aero state logic: straight line high-speed acceleration engages X-Mode
    const isXModeActive = throttleVal > 85 && Math.abs(gLatVal) < 1.6 && speedVal > 220;

    return {
      distance: Math.round(hoverDistanceM),
      realSpeed: Math.round(realTel.speed[realIdx] || 0),
      simSpeed: Math.round(speedVal),
      simFreeSpeed: Math.round(simulation.speedFreeKmh[simIdx] || 0),
      throttle: Math.round(throttleVal),
      brake: Math.round(simulation.brakePct[simIdx] || 0),
      gear: simulation.gear[simIdx] || 1,
      gLat: gLatVal.toFixed(2),
      gLong: (simulation.gLong[simIdx] || 0).toFixed(2),
      socMJ: ((simulation.ers.socTrace[simIdx] || 0) / 1e6).toFixed(2),
      isXMode: isXModeActive,
    };
  }, [hoverDistanceM, realTel, simDist, simSpeed, simulation]);

  // SVG channel heights
  const svgWidth = 1000;
  const speedH = 175;
  const pedalsH = 85;
  const gforceH = 85;
  const ersH = 85;

  // Coordinate scales
  const scaleX = (d: number) => (d / maxDist) * svgWidth;
  const scaleSpeedY = (v: number) => speedH - (v / 380) * speedH;
  const scalePctY = (p: number) => pedalsH - (p / 100) * pedalsH;
  const scaleGY = (g: number) => gforceH / 2 - (g / 6.0) * (gforceH / 2);
  const scaleSocY = (socJ: number) => ersH - (socJ / 5.4e6) * ersH;

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
    <div className="obsidian-card rounded-2xl border border-white/10 flex flex-col shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* 1. Command Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10 bg-[#0A0D15]/80">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black tracking-wider text-white uppercase mono">
            TELEMETRY OSCILLOSCOPE // {circuit.name.toUpperCase()}
          </span>
          <div className="flex items-center gap-3 text-xs mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#00F0FF] rounded-full inline-block shadow-[0_0_6px_#00F0FF]" />
              <span className="text-[#00F0FF] text-[11px] font-bold">
                SIM ({activeMetrics.simSpeed} km/h)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#FF2800] rounded-full inline-block shadow-[0_0_6px_#FF2800]" />
              <span className="text-[#FF2800] text-[11px] font-bold">
                POLE ({activeMetrics.realSpeed} km/h)
              </span>
            </div>
          </div>
        </div>

        {/* Channel Segmented Filter */}
        <div className="flex items-center bg-[#05070B] p-0.5 rounded-xl border border-white/10">
          {(['all', 'speed', 'pedals', 'gforce', 'ers'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setActiveChannel(ch)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all mono cursor-pointer ${
                activeChannel === ch
                  ? 'bg-[#161B28] text-white shadow-[0_0_10px_rgba(255,255,255,0.1)] border border-white/10'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Cursor Scrubber Telemetry Metrics Strip */}
      <div className="px-4 py-2.5 bg-[#080B12]/90 border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs mono items-center">
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">DISTANCE</span>
          <span className="text-white font-bold tabular">{activeMetrics.distance.toLocaleString()}m</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">THROTTLE</span>
          <span className="text-[#00E676] font-bold tabular">{activeMetrics.throttle}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">BRAKE</span>
          <span className="text-[#FF2800] font-bold tabular">{activeMetrics.brake}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">GEAR</span>
          <span className="text-[#00F0FF] font-bold tabular">G{activeMetrics.gear}</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">LAT G</span>
          <span className="text-[#FFB300] font-bold tabular">{activeMetrics.gLat} g</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">LONG G</span>
          <span className="text-[#00F0FF] font-bold tabular">{activeMetrics.gLong} g</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">ERS SOC</span>
          <span className="text-[#B829EA] font-bold tabular">{activeMetrics.socMJ} MJ</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">AERO MODE</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              activeMetrics.isXMode
                ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                : 'bg-white/5 text-[#94A3B8] border border-white/10'
            }`}
          >
            {activeMetrics.isXMode ? 'X-MODE' : 'Z-MODE'}
          </span>
        </div>
      </div>

      {/* 3. SVG Multi-Channel Telemetry Graph with CAD Grid */}
      <div className="relative p-4 bg-[#05070B] overflow-hidden select-none technical-grid">
        {/* Floating Glass Tooltip at Crosshair */}
        <div
          className="absolute top-2 pointer-events-none transition-all duration-75 z-20 hidden sm:block"
          style={{
            left: `${Math.min(84, Math.max(16, (hoverDistanceM / maxDist) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="obsidian-pill px-3 py-1 rounded-xl shadow-2xl border border-white/15 text-[11px] font-mono whitespace-nowrap flex items-center gap-2 backdrop-blur-xl">
            <span className="text-[#00F0FF] font-black">{activeMetrics.simSpeed} km/h</span>
            <span className="text-white/20">•</span>
            <span className="text-white font-bold">G{activeMetrics.gear}</span>
            <span className="text-white/20">•</span>
            <span className="text-[#00E676]">{activeMetrics.throttle}% THR</span>
            {activeMetrics.brake > 0 && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-[#FF2800]">{activeMetrics.brake}% BRK</span>
              </>
            )}
            <span className="text-white/20">•</span>
            <span className="text-[#94A3B8]">{activeMetrics.distance.toLocaleString()}m</span>
          </div>
        </div>

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
          {/* Base Grid Lines */}
          <line x1="0" y1="0" x2={svgWidth} y2="0" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <line x1="0" y1={speedH} x2={svgWidth} y2={speedH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Sector Division Lines */}
          {simulation.sectorBoundsM && (
            <>
              <line
                x1={scaleX(simulation.sectorBoundsM[0])}
                y1="0"
                x2={scaleX(simulation.sectorBoundsM[0])}
                y2="500"
                stroke="#FFB300"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.3"
              />
              <line
                x1={scaleX(simulation.sectorBoundsM[1])}
                y1="0"
                x2={scaleX(simulation.sectorBoundsM[1])}
                y2="500"
                stroke="#00F0FF"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.3"
              />
            </>
          )}

          {/* SPEED CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'speed') && (
            <g>
              <text x="8" y="20" fill="#64748B" fontSize="9" fontFamily="monospace" fontWeight="bold">
                350 km/h
              </text>
              <line x1="0" y1={scaleSpeedY(350)} x2={svgWidth} y2={scaleSpeedY(350)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />
              <text x="8" y={scaleSpeedY(200) - 4} fill="#64748B" fontSize="9" fontFamily="monospace" fontWeight="bold">
                200 km/h
              </text>
              <line x1="0" y1={scaleSpeedY(200)} x2={svgWidth} y2={scaleSpeedY(200)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />
              <text x="8" y={scaleSpeedY(80) - 4} fill="#64748B" fontSize="9" fontFamily="monospace" fontWeight="bold">
                80 km/h
              </text>
              <line x1="0" y1={scaleSpeedY(80)} x2={svgWidth} y2={scaleSpeedY(80)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />

              {/* FastF1 Benchmark Speed Trace (Rosso Corsa Red) */}
              {realSpeedPath && (
                <polyline
                  points={realSpeedPath}
                  fill="none"
                  stroke="#FF2800"
                  strokeWidth="1.8"
                  strokeOpacity="0.8"
                />
              )}

              {/* Simulation Speed Trace (Electric Cyan) */}
              {simSpeedPath && (
                <polyline
                  points={simSpeedPath}
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="2.5"
                  className="filter drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]"
                />
              )}
            </g>
          )}

          {/* PEDALS CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'pedals') && (
            <g transform={`translate(0, ${activeChannel === 'all' ? speedH + 20 : 0})`}>
              <line x1="0" y1={pedalsH} x2={svgWidth} y2={pedalsH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="8" y="16" fill="#64748B" fontSize="9" fontFamily="monospace" fontWeight="bold">
                PEDALS 100%
              </text>
              {throttlePath && (
                <polyline points={throttlePath} fill="none" stroke="#00E676" strokeWidth="1.8" />
              )}
              {brakePath && (
                <polyline points={brakePath} fill="none" stroke="#FF2800" strokeWidth="1.8" />
              )}
            </g>
          )}

          {/* G-FORCE CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'gforce') && (
            <g transform={`translate(0, ${activeChannel === 'all' ? speedH + pedalsH + 40 : 0})`}>
              <line x1="0" y1={gforceH / 2} x2={svgWidth} y2={gforceH / 2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="8" y="16" fill="#64748B" fontSize="9" fontFamily="monospace" fontWeight="bold">
                G-FORCE (±5G)
              </text>
              <polyline
                points={simDist
                  .map((d, i) => `${scaleX(d).toFixed(1)},${scaleGY(simulation.gLat[i] || 0).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#FFB300"
                strokeWidth="1.5"
              />
              <polyline
                points={simDist
                  .map((d, i) => `${scaleX(d).toFixed(1)},${scaleGY(simulation.gLong[i] || 0).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#00F0FF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* ERS SOC CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'ers') && (
            <g transform={`translate(0, ${activeChannel === 'all' ? speedH + pedalsH + gforceH + 60 : 0})`}>
              <line x1="0" y1={ersH} x2={svgWidth} y2={ersH} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x="8" y="16" fill="#64748B" fontSize="9" fontFamily="monospace" fontWeight="bold">
                ERS BATTERY STORE (MJ)
              </text>
              {socPath && (
                <polyline points={socPath} fill="none" stroke="#B829EA" strokeWidth="2" />
              )}
            </g>
          )}

          {/* Crosshair Cursor */}
          <line
            x1={crosshairX}
            y1="0"
            x2={crosshairX}
            y2="500"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            strokeOpacity="0.8"
          />
        </svg>
      </div>

      {/* 4. Bottom Speed Trap & Sectors Benchmark Footer */}
      <div className="px-4 py-2.5 bg-[#080B12]/90 border-t border-white/5 flex flex-wrap items-center justify-between text-xs mono text-[#94A3B8]">
        <div className="flex items-center gap-4">
          <span>
            Speed Trap: <strong className="text-white">{simulation.speedTrapKmh.toFixed(1)} km/h</strong>
          </span>
          <span className="text-white/10">|</span>
          <span>
            S1: <strong className="text-[#FFB300]">{simulation.sectorTimes[0].toFixed(3)}s</strong>
          </span>
          <span>
            S2: <strong className="text-[#00F0FF]">{simulation.sectorTimes[1].toFixed(3)}s</strong>
          </span>
          <span>
            S3: <strong className="text-[#B829EA]">{simulation.sectorTimes[2].toFixed(3)}s</strong>
          </span>
        </div>
        <div>
          ERS Clipped Distance: <strong className="text-[#FFB300]">{simulation.ers.clipDistanceM.toFixed(0)}m</strong>
        </div>
      </div>
    </div>
  );
}
