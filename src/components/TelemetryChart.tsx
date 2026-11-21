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
  const maxDist = circuit.lapLengthM || 5000;

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
    const isXModeActive = throttleVal > 85 && Math.abs(gLatVal) < 1.6 && speedVal > 220;

    return {
      distance: Math.round(hoverDistanceM),
      realSpeed: Math.round(realTel.speed[realIdx] || 0),
      simSpeed: Math.round(speedVal),
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
  const speedH = 160;
  const pedalsH = 80;
  const gforceH = 80;
  const ersH = 80;

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

  // Generate dual-density vertical distance gridlines
  const verticalGridlines = useMemo(() => {
    const majorDist = maxDist > 5500 ? 1000 : 500;
    const minorDist = 200;
    const lines: { x: number; isMajor: boolean; label?: string }[] = [];

    for (let d = 0; d <= maxDist; d += minorDist) {
      const isMajor = d % majorDist === 0;
      lines.push({
        x: scaleX(d),
        isMajor,
        label: isMajor ? `${d}m` : undefined,
      });
    }
    return lines;
  }, [maxDist]);

  return (
    <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] flex flex-col overflow-hidden select-none font-mono">
      {/* 1. Command Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#1E222B] bg-[#0A0C10]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-wider text-white uppercase">
            LIVE CHANNELS — 100Hz
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[1px] bg-[#00E5FF] inline-block" />
              <span className="text-[#00E5FF] font-bold tabular">
                SIM {activeMetrics.simSpeed} km/h
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-[1px] bg-[#FF2A54] inline-block" />
              <span className="text-[#FF2A54] font-bold tabular">
                POLE {activeMetrics.realSpeed} km/h
              </span>
            </div>
          </div>
        </div>

        {/* Compact Channel Filter Toggles with Status Dots */}
        <div className="flex items-center bg-[#14171E] p-0.5 border border-[#1E222B] rounded-[2px] text-[10px]">
          {(
            [
              { id: 'all', label: 'ALL', dot: '#FFFFFF' },
              { id: 'speed', label: 'SPEED', dot: '#00E5FF' },
              { id: 'pedals', label: 'PEDALS', dot: '#00E676' },
              { id: 'gforce', label: 'GFORCE', dot: '#FFB300' },
              { id: 'ers', label: 'ERS', dot: '#B829EA' },
            ] as const
          ).map((ch) => {
            const isSel = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-[1px] font-bold tracking-wider transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-[#1E2433] text-white border border-[#2D384D]'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ backgroundColor: ch.dot }}
                />
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Cursor Scrubber Telemetry Metrics Strip */}
      <div className="px-3 py-1.5 bg-[#0D0F13] border-b border-[#1E222B] grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs items-center">
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">DISTANCE</span>
          <span className="text-white font-bold tabular">{activeMetrics.distance.toLocaleString()}m</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">THROTTLE</span>
          <span className="text-[#00E676] font-bold tabular">{activeMetrics.throttle}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">BRAKE</span>
          <span className="text-[#FF2A54] font-bold tabular">{activeMetrics.brake}%</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">GEAR</span>
          <span className="text-white font-bold tabular">G{activeMetrics.gear}</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">LAT G</span>
          <span className="text-[#FFB300] font-bold tabular">{activeMetrics.gLat}G</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">LONG G</span>
          <span className="text-[#00E5FF] font-bold tabular">{activeMetrics.gLong}G</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">ERS SOC</span>
          <span className="text-[#B829EA] font-bold tabular">{activeMetrics.socMJ} MJ</span>
        </div>
        <div>
          <span className="text-[#64748B] block text-[9px] uppercase">AERO MODE</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[1px] ${
              activeMetrics.isXMode
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40'
                : 'bg-[#1E2433] text-[#94A3B8] border border-[#2A354A]'
            }`}
          >
            {activeMetrics.isXMode ? 'X-MODE' : 'Z-MODE'}
          </span>
        </div>
      </div>

      {/* 3. SVG Multi-Channel Telemetry Graph with Dual-Density Grid */}
      <div className="relative p-2 bg-[#07080A] overflow-hidden select-none">
        {/* Floating Tooltip at Crosshair */}
        <div
          className="absolute top-2 pointer-events-none transition-all duration-75 z-20 hidden sm:block"
          style={{
            left: `${Math.min(84, Math.max(16, (hoverDistanceM / maxDist) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-[#0D0F13] px-2.5 py-0.5 rounded-[2px] border border-[#1E222B] text-[10px] font-mono whitespace-nowrap flex items-center gap-1.5 shadow-none">
            <span className="text-[#00E5FF] font-bold tabular">{activeMetrics.simSpeed} km/h</span>
            <span className="text-[#3E485B]">|</span>
            <span className="text-white font-bold">G{activeMetrics.gear}</span>
            <span className="text-[#3E485B]">|</span>
            <span className="text-[#00E676] tabular">{activeMetrics.throttle}% THR</span>
            {activeMetrics.brake > 0 && (
              <>
                <span className="text-[#3E485B]">|</span>
                <span className="text-[#FF2A54] tabular">{activeMetrics.brake}% BRK</span>
              </>
            )}
            <span className="text-[#3E485B]">|</span>
            <span className="text-[#94A3B8] tabular">{activeMetrics.distance.toLocaleString()}m</span>
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
          {/* Dual-Density Vertical Gridlines */}
          {verticalGridlines.map((vl, idx) => (
            <g key={`vgrid-${idx}`}>
              <line
                x1={vl.x}
                y1="0"
                x2={vl.x}
                y2="500"
                stroke={vl.isMajor ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
                strokeWidth={vl.isMajor ? '1' : '0.5'}
              />
              {vl.isMajor && (
                <text
                  x={vl.x + 3}
                  y="12"
                  fill="#475569"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {vl.label}
                </text>
              )}
            </g>
          ))}

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
                strokeOpacity="0.4"
              />
              <line
                x1={scaleX(simulation.sectorBoundsM[1])}
                y1="0"
                x2={scaleX(simulation.sectorBoundsM[1])}
                y2="500"
                stroke="#00E5FF"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.4"
              />
            </>
          )}

          {/* SPEED CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'speed') && (
            <g id="channel-speed">
              {/* Channel Divider */}
              <line x1="0" y1={speedH} x2={svgWidth} y2={speedH} stroke="#1E222B" strokeWidth="1" />

              {/* Pinned Y-Axis Unit Scale Labels */}
              <text x="6" y="16" fill="#00E5FF" fontSize="9" fontFamily="monospace" fontWeight="bold">
                SPEED (km/h)
              </text>
              <text x="6" y={scaleSpeedY(350) + 3} fill="#64748B" fontSize="8" fontFamily="monospace">
                350
              </text>
              <line x1="0" y1={scaleSpeedY(350)} x2={svgWidth} y2={scaleSpeedY(350)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />
              <text x="6" y={scaleSpeedY(200) + 3} fill="#64748B" fontSize="8" fontFamily="monospace">
                200
              </text>
              <line x1="0" y1={scaleSpeedY(200)} x2={svgWidth} y2={scaleSpeedY(200)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />
              <text x="6" y={scaleSpeedY(80) + 3} fill="#64748B" fontSize="8" fontFamily="monospace">
                80
              </text>
              <line x1="0" y1={scaleSpeedY(80)} x2={svgWidth} y2={scaleSpeedY(80)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 4" />

              {/* FastF1 Pole Benchmark Trace (#FF2A54 - Solid 1.5px) */}
              {realSpeedPath && (
                <polyline
                  points={realSpeedPath}
                  fill="none"
                  stroke="#FF2A54"
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                />
              )}

              {/* Simulated Speed Trace (#00E5FF - Solid 1.5px, NO drop-shadow glow) */}
              {simSpeedPath && (
                <polyline
                  points={simSpeedPath}
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}

          {/* PEDALS CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'pedals') && (
            <g id="channel-pedals" transform={`translate(0, ${activeChannel === 'all' ? speedH + 20 : 0})`}>
              <line x1="0" y1={pedalsH} x2={svgWidth} y2={pedalsH} stroke="#1E222B" strokeWidth="1" />
              <text x="6" y="14" fill="#00E676" fontSize="9" fontFamily="monospace" fontWeight="bold">
                PEDALS (%)
              </text>
              <text x="6" y="28" fill="#64748B" fontSize="8" fontFamily="monospace">
                100%
              </text>
              <text x="6" y={pedalsH - 4} fill="#64748B" fontSize="8" fontFamily="monospace">
                0%
              </text>

              {throttlePath && (
                <polyline points={throttlePath} fill="none" stroke="#00E676" strokeWidth="1.5" />
              )}
              {brakePath && (
                <polyline points={brakePath} fill="none" stroke="#FF2A54" strokeWidth="1.5" />
              )}
            </g>
          )}

          {/* G-FORCE CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'gforce') && (
            <g id="channel-gforce" transform={`translate(0, ${activeChannel === 'all' ? speedH + pedalsH + 40 : 0})`}>
              <line x1="0" y1={gforceH} x2={svgWidth} y2={gforceH} stroke="#1E222B" strokeWidth="1" />
              <line x1="0" y1={gforceH / 2} x2={svgWidth} y2={gforceH / 2} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x="6" y="14" fill="#FFB300" fontSize="9" fontFamily="monospace" fontWeight="bold">
                G-FORCE (G)
              </text>
              <text x="6" y="26" fill="#64748B" fontSize="8" fontFamily="monospace">
                +4G
              </text>
              <text x="6" y={gforceH / 2 - 2} fill="#64748B" fontSize="8" fontFamily="monospace">
                0G
              </text>
              <text x="6" y={gforceH - 4} fill="#64748B" fontSize="8" fontFamily="monospace">
                -4G
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
                stroke="#00E5FF"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* ERS SOC CHANNEL */}
          {(activeChannel === 'all' || activeChannel === 'ers') && (
            <g id="channel-ers" transform={`translate(0, ${activeChannel === 'all' ? speedH + pedalsH + gforceH + 60 : 0})`}>
              <line x1="0" y1={ersH} x2={svgWidth} y2={ersH} stroke="#1E222B" strokeWidth="1" />
              <text x="6" y="14" fill="#B829EA" fontSize="9" fontFamily="monospace" fontWeight="bold">
                ERS ENERGY (MJ)
              </text>
              <text x="6" y="26" fill="#64748B" fontSize="8" fontFamily="monospace">
                5.4 MJ
              </text>
              <text x="6" y={ersH - 4} fill="#64748B" fontSize="8" fontFamily="monospace">
                0 MJ
              </text>

              {socPath && (
                <polyline points={socPath} fill="none" stroke="#B829EA" strokeWidth="1.5" />
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
            strokeWidth="1.2"
            strokeDasharray="3 3"
            strokeOpacity="0.75"
          />
        </svg>
      </div>

      {/* 4. Bottom Speed Trap & Sectors Benchmark Footer */}
      <div className="px-3 py-1.5 bg-[#0D0F13] border-t border-[#1E222B] flex flex-wrap items-center justify-between text-xs text-[#94A3B8]">
        <div className="flex items-center gap-3">
          <span>
            Speed Trap: <strong className="text-white tabular">{simulation.speedTrapKmh.toFixed(1)} km/h</strong>
          </span>
          <span className="text-[#1E222B]">|</span>
          <span>
            S1: <strong className="text-[#FFB300] tabular">{simulation.sectorTimes[0].toFixed(3)}s</strong>
          </span>
          <span>
            S2: <strong className="text-[#00E5FF] tabular">{simulation.sectorTimes[1].toFixed(3)}s</strong>
          </span>
          <span>
            S3: <strong className="text-[#B829EA] tabular">{simulation.sectorTimes[2].toFixed(3)}s</strong>
          </span>
        </div>
        <div>
          ERS Clipped: <strong className="text-[#FFB300] tabular">{simulation.ers.clipDistanceM.toFixed(0)}m</strong>
        </div>
      </div>
    </div>
  );
}
