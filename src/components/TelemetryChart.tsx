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

  // SVG channel heights
  const svgWidth = 1000;
  const speedH = 180;
  const pedalsH = 90;
  const gforceH = 90;
  const ersH = 90;

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
    <div className="bg-[#0B0F19] border border-[#1A2336] rounded-xl flex flex-col shadow-2xl overflow-hidden">
      {/* 1. Command Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#1A2336]/80 bg-[#0E1321]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-black tracking-wider text-white uppercase mono">
            TELEMETRY CHANNELS // {circuit.name.toUpperCase()}
          </span>
          <div className="flex items-center gap-3 text-xs mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#00F0FF] rounded-full inline-block" />
              <span className="text-[#00F0FF] text-[11px] font-bold">
                SIM ({activeMetrics.simSpeed} km/h)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#E10600] rounded-full inline-block" />
              <span className="text-[#E10600] text-[11px] font-bold">
                POLE ({activeMetrics.realSpeed} km/h)
              </span>
            </div>
          </div>
        </div>

        {/* Channel Segmented Filter */}
        <div className="flex items-center bg-[#07090E] p-0.5 rounded-lg border border-[#1A2336]">
          {(['all', 'speed', 'pedals', 'gforce', 'ers'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all mono ${
                activeChannel === ch
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Cursor Scrubber Telemetry Metrics Strip */}
      <div className="px-4 py-2 bg-[#080B12] border-b border-[#1A2336]/60 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs mono">
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">DISTANCE</span>
          <span className="text-white font-bold tabular">{activeMetrics.distance} m</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">THROTTLE</span>
          <span className="text-[#00E676] font-bold tabular">{activeMetrics.throttle}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">BRAKE</span>
          <span className="text-[#E10600] font-bold tabular">{activeMetrics.brake}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">GEAR</span>
          <span className="text-[#00F0FF] font-bold tabular">G{activeMetrics.gear}</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">LAT G</span>
          <span className="text-[#FFB703] font-bold tabular">{activeMetrics.gLat} g</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">LONG G</span>
          <span className="text-[#00F0FF] font-bold tabular">{activeMetrics.gLong} g</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] font-bold uppercase">ERS SOC</span>
          <span className="text-[#FF7A00] font-bold tabular">{activeMetrics.socMJ} MJ</span>
        </div>
      </div>

      {/* 3. SVG Multi-Channel Telemetry Graph */}
      <div className="p-4 bg-[#05070B] overflow-hidden select-none">
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
          <line x1="0" y1="0" x2={svgWidth} y2="0" stroke="#161F2E" strokeWidth="1" />
          <line x1="0" y1={speedH} x2={svgWidth} y2={speedH} stroke="#161F2E" strokeWidth="1" />

          {/* Sector Division Lines */}
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
                strokeOpacity="0.3"
              />
              <line
                x1={scaleX(simulation.sectorBoundsM[1])}
                y1="0"
                x2={scaleX(simulation.sectorBoundsM[1])}
                y2="500"
                stroke="#FFB703"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.3"
              />
            </>
          )}

          {/* SPEED CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'speed') && (
            <g>
              <text x="8" y="20" fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="bold">
                350 km/h
              </text>
              <line x1="0" y1={scaleSpeedY(350)} x2={svgWidth} y2={scaleSpeedY(350)} stroke="#141C2B" strokeWidth="1" strokeDasharray="2 4" />
              <text x="8" y={scaleSpeedY(200) - 4} fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="bold">
                200 km/h
              </text>
              <line x1="0" y1={scaleSpeedY(200)} x2={svgWidth} y2={scaleSpeedY(200)} stroke="#141C2B" strokeWidth="1" strokeDasharray="2 4" />
              <text x="8" y={scaleSpeedY(80) - 4} fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="bold">
                80 km/h
              </text>
              <line x1="0" y1={scaleSpeedY(80)} x2={svgWidth} y2={scaleSpeedY(80)} stroke="#141C2B" strokeWidth="1" strokeDasharray="2 4" />

              {/* FastF1 Benchmark Speed Trace (Red) */}
              {realSpeedPath && (
                <polyline
                  points={realSpeedPath}
                  fill="none"
                  stroke="#E10600"
                  strokeWidth="2"
                  strokeOpacity="0.8"
                />
              )}

              {/* Simulation Speed Trace (Cyan) */}
              {simSpeedPath && (
                <polyline
                  points={simSpeedPath}
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="2.5"
                />
              )}
            </g>
          )}

          {/* PEDALS CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'pedals') && (
            <g transform={`translate(0, ${activeChannel === 'all' ? speedH + 20 : 0})`}>
              <line x1="0" y1={pedalsH} x2={svgWidth} y2={pedalsH} stroke="#161F2E" strokeWidth="1" />
              <text x="8" y="16" fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="bold">
                PEDALS 100%
              </text>
              {throttlePath && (
                <polyline points={throttlePath} fill="none" stroke="#00E676" strokeWidth="1.8" />
              )}
              {brakePath && (
                <polyline points={brakePath} fill="none" stroke="#E10600" strokeWidth="1.8" />
              )}
            </g>
          )}

          {/* G-FORCE CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'gforce') && (
            <g transform={`translate(0, ${activeChannel === 'all' ? speedH + pedalsH + 40 : 0})`}>
              <line x1="0" y1={gforceH / 2} x2={svgWidth} y2={gforceH / 2} stroke="#1A2336" strokeWidth="1" />
              <text x="8" y="16" fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="bold">
                G-FORCE (±5G)
              </text>
              <polyline
                points={simDist
                  .map((d, i) => `${scaleX(d).toFixed(1)},${scaleGY(simulation.gLat[i] || 0).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke="#FFB703"
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
              <line x1="0" y1={ersH} x2={svgWidth} y2={ersH} stroke="#161F2E" strokeWidth="1" />
              <text x="8" y="16" fill="#475569" fontSize="9" fontFamily="monospace" fontWeight="bold">
                ERS BATTERY STORE (MJ)
              </text>
              {socPath && (
                <polyline points={socPath} fill="none" stroke="#FF7A00" strokeWidth="2" />
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
      <div className="px-4 py-2.5 bg-[#080B12] border-t border-[#1A2336]/60 flex flex-wrap items-center justify-between text-xs mono text-[#94A3B8]">
        <div className="flex items-center gap-4">
          <span>
            Speed Trap: <strong className="text-white">{simulation.speedTrapKmh.toFixed(1)} km/h</strong>
          </span>
          <span className="text-[#1A2336]">|</span>
          <span>
            S1: <strong className="text-[#FFB703]">{simulation.sectorTimes[0].toFixed(3)}s</strong>
          </span>
          <span>
            S2: <strong className="text-[#00F0FF]">{simulation.sectorTimes[1].toFixed(3)}s</strong>
          </span>
          <span>
            S3: <strong className="text-[#D946EF]">{simulation.sectorTimes[2].toFixed(3)}s</strong>
          </span>
        </div>
        <div>
          ERS Clipped Distance: <strong className="text-[#FF7A00]">{simulation.ers.clipDistanceM.toFixed(0)}m</strong>
        </div>
      </div>
    </div>
  );
}
