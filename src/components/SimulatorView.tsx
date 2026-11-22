'use client';

import React, { useState, useMemo } from 'react';
import { CircuitData, CompoundName } from '../engine/types';
import { car2025, car2026 } from '../engine/carModel';
import { simulateLap } from '../engine/lapSim';
import { COMPOUNDS, gripMultiplier } from '../engine/tyreModel';
import TrackMap from './TrackMap';
import TelemetryChart from './TelemetryChart';
import { Battery } from 'lucide-react';

interface SimulatorViewProps {
  circuit: CircuitData;
  era: '2025' | '2026';
}

// Micro Sparkline component for Sector velocity traces
function SectorSparkline({
  speeds,
  color,
}: {
  speeds: number[];
  color: string;
}) {
  if (!speeds || speeds.length < 2) return null;

  const step = Math.max(1, Math.floor(speeds.length / 35));
  const samples = speeds.filter((_, idx) => idx % step === 0);
  const minSpeed = Math.min(...samples);
  const maxSpeed = Math.max(...samples);
  const range = maxSpeed - minSpeed || 1;

  const width = 100;
  const height = 18;
  const points = samples
    .map((s, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = height - ((s - minSpeed) / range) * (height - 3) - 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="relative mt-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-4 overflow-visible"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

export default function SimulatorView({ circuit, era }: SimulatorViewProps) {
  // Simulator tuning parameters
  const [compound, setCompound] = useState<CompoundName>('soft');
  const [trim, setTrim] = useState<'qualifying' | 'race'>('qualifying');
  const [aeroOffset, setAeroOffset] = useState<number>(0);
  const [hoverDistM, setHoverDistM] = useState<number>(0);

  // Derive configured car model
  const car = useMemo(() => {
    const base = era === '2025' ? car2025(circuit.name, trim) : car2026(circuit.name, trim);
    const aeroMult = 1.0 + aeroOffset / 100.0;
    return {
      ...base,
      ClA: base.ClA * aeroMult,
      CdA: base.CdA * (1.0 + (aeroOffset / 100.0) * 0.4),
      cornerClA: base.cornerClA ? base.cornerClA * aeroMult : undefined,
    };
  }, [era, circuit.name, trim, aeroOffset]);

  // Run physics engine simulation (<2 ms client-side)
  const simulation = useMemo(() => {
    const tyre = COMPOUNDS[compound];
    const gMult = gripMultiplier(tyre, 1, circuit.tyreStress || 1.0);
    return simulateLap(circuit, car, {
      step: 3.0,
      gripMultiplier: gMult,
      energySolve: true,
    });
  }, [circuit, car, compound]);

  // Pole comparison delta
  const poleDelta = simulation.lapTime - circuit.poleLapTime;
  const isFasterThanPole = poleDelta <= 0;

  const formatLapTime = (timeS: number) => {
    const mins = Math.floor(timeS / 60);
    const secs = (timeS % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  // Slice speeds for each sector for micro sparklines
  const sectorSpeeds = useMemo(() => {
    const dist = simulation.distance;
    const spd = simulation.speedKmh;
    const s1End = simulation.sectorBoundsM[0];
    const s2End = simulation.sectorBoundsM[1];

    const s1: number[] = [];
    const s2: number[] = [];
    const s3: number[] = [];

    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      if (d <= s1End) s1.push(spd[i]);
      else if (d <= s2End) s2.push(spd[i]);
      else s3.push(spd[i]);
    }
    return { s1, s2, s3 };
  }, [simulation]);

  return (
    <div className="space-y-2 w-full font-mono select-none">
      {/* 1. Hero KPI Strip (Utilitarian Flat Dock with Hairline Dividers) */}
      <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-2.5 sm:px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-5 items-center divide-y lg:divide-y-0 lg:divide-x divide-[#1E222B]">
          {/* A. Massive Simulated Lap Time & Delta */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1 pt-0">
            <span className="text-[9px] font-bold tracking-widest uppercase text-[#64748B] block">
              SIMULATED LAP TIME
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-black text-2xl sm:text-3xl text-white tabular tracking-tight">
                {formatLapTime(simulation.lapTime)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-[1px] tabular ${
                  isFasterThanPole
                    ? 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40'
                    : 'bg-[#FF2A54]/20 text-[#FF2A54] border border-[#FF2A54]/40'
                }`}
              >
                {isFasterThanPole ? '-' : '+'}
                {Math.abs(poleDelta).toFixed(3)}s vs Pole
              </span>
              <span className="text-[10px] text-[#64748B] tabular hidden sm:inline">
                {circuit.poleDriver} {formatLapTime(circuit.poleLapTime)}
              </span>
            </div>
          </div>

          {/* B. Speed Trap V_Max */}
          <div className="pt-2 lg:pt-0 lg:pl-5">
            <span className="text-[9px] font-bold tracking-widest uppercase text-[#64748B] block">
              SPEED TRAP V_MAX
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display font-black text-xl sm:text-2xl text-white tabular">
                {simulation.speedTrapKmh.toFixed(1)}
              </span>
              <span className="text-xs text-[#64748B]">km/h</span>
            </div>
            <span className="text-[10px] text-[#00E5FF] tabular mt-0.5 block">
              Benchmark: {circuit.topSpeedKmh} km/h
            </span>
          </div>

          {/* C. Sector 1 (Amber) */}
          <div className="pt-2 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-widest uppercase text-[#64748B]">
                SECTOR 1
              </span>
              <span className="text-[9px] text-[#64748B] tabular">
                {(simulation.sectorBoundsM[0] / 1000).toFixed(2)}km
              </span>
            </div>
            <div className="font-display font-bold text-xl text-[#FFB300] tabular mt-0.5">
              {simulation.sectorTimes[0].toFixed(3)}s
            </div>
            <SectorSparkline speeds={sectorSpeeds.s1} color="#FFB300" />
          </div>

          {/* D. Sector 2 (Cyan) */}
          <div className="pt-2 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-widest uppercase text-[#64748B]">
                SECTOR 2
              </span>
              <span className="text-[9px] text-[#64748B] tabular">
                {((simulation.sectorBoundsM[1] - simulation.sectorBoundsM[0]) / 1000).toFixed(2)}km
              </span>
            </div>
            <div className="font-display font-bold text-xl text-[#00E5FF] tabular mt-0.5">
              {simulation.sectorTimes[1].toFixed(3)}s
            </div>
            <SectorSparkline speeds={sectorSpeeds.s2} color="#00E5FF" />
          </div>

          {/* E. Sector 3 (Electric Violet) */}
          <div className="pt-2 lg:pt-0 lg:pl-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-widest uppercase text-[#64748B]">
                SECTOR 3
              </span>
              <span className="text-[9px] text-[#64748B] tabular">
                {((circuit.lapLengthM - simulation.sectorBoundsM[1]) / 1000).toFixed(2)}km
              </span>
            </div>
            <div className="font-display font-bold text-xl text-[#B829EA] tabular mt-0.5">
              {simulation.sectorTimes[2].toFixed(3)}s
            </div>
            <SectorSparkline speeds={sectorSpeeds.s3} color="#B829EA" />
          </div>
        </div>
      </div>

      {/* 2. Tactical Vehicle Calibration Deck */}
      <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Deck Title */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] inline-block" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              VEHICLE CALIBRATION
            </span>
          </div>

          {/* Controls Dock */}
          <div className="flex flex-wrap items-center gap-5 text-xs">
            {/* Pirelli Sidewall Ring Badges */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] font-bold text-[10px] uppercase tracking-wider">PIRELLI TYRE:</span>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'soft', label: 'S', color: '#FF2800', name: 'Soft' },
                    { id: 'medium', label: 'M', color: '#FFB300', name: 'Medium' },
                    { id: 'hard', label: 'H', color: '#FFFFFF', name: 'Hard' },
                    { id: 'inter', label: 'I', color: '#00E676', name: 'Intermediate' },
                    { id: 'wet', label: 'W', color: '#00F0FF', name: 'Full Wet' },
                  ] as const
                ).map((t) => {
                  const isSel = compound === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCompound(t.id)}
                      title={`${t.name} Compound`}
                      className={`relative flex items-center justify-center w-7 h-7 rounded-full font-mono font-black text-xs transition-all cursor-pointer ${
                        isSel
                          ? 'scale-110 shadow-lg'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{
                        background: isSel ? '#12151E' : '#090C14',
                        boxShadow: isSel ? `0 0 12px ${t.color}50` : undefined,
                      }}
                    >
                      {/* Authentic Sidewall Ring */}
                      <svg viewBox="0 0 32 32" className="absolute inset-0 w-full h-full pointer-events-none">
                        <circle
                          cx="16"
                          cy="16"
                          r="13"
                          fill="none"
                          stroke={t.color}
                          strokeWidth={isSel ? '3' : '2'}
                          strokeDasharray="18 4 18 4"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span style={{ color: isSel ? t.color : '#94A3B8' }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fuel Load Segmented Switch */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] font-bold text-[10px] uppercase">FUEL:</span>
              <div className="flex items-center bg-[#14171E] rounded-[2px] p-0.5 border border-[#1E222B]">
                <button
                  type="button"
                  onClick={() => setTrim('qualifying')}
                  className={`px-2 py-0.5 rounded-[1px] text-[10px] font-bold transition-colors cursor-pointer ${
                    trim === 'qualifying'
                      ? 'bg-[#FF2A54] text-white'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  QUALI (5kg)
                </button>
                <button
                  type="button"
                  onClick={() => setTrim('race')}
                  className={`px-2 py-0.5 rounded-[1px] text-[10px] font-bold transition-colors cursor-pointer ${
                    trim === 'race'
                      ? 'bg-[#00E5FF] text-[#07080A]'
                      : 'text-[#64748B] hover:text-[#94A3B8]'
                  }`}
                >
                  RACE (105kg)
                </button>
              </div>
            </div>

            {/* Aero Trim Precision Dial */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B] font-bold text-[10px] uppercase">AERO TRIM:</span>
              <div className="flex items-center gap-2 bg-[#14171E] px-2 py-0.5 rounded-[2px] border border-[#1E222B]">
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={2}
                  value={aeroOffset}
                  onChange={(e) => setAeroOffset(parseInt(e.target.value))}
                  className="w-16 accent-[#00E5FF] cursor-pointer h-1 bg-[#0D0F13] rounded-[1px]"
                />
                <span className="w-8 text-white font-bold text-right tabular text-[10px]">
                  {aeroOffset > 0 ? `+${aeroOffset}%` : `${aeroOffset}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Split-Screen Layout (40% Track Map / 60% Telemetry Oscilloscope with 8px gap) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start w-full">
        {/* Left Panel: 40% (5 cols): 2D/3D Circuit Map */}
        <div className="lg:col-span-5 space-y-2">
          <TrackMap
            circuit={circuit}
            activeDistanceM={hoverDistM}
            onHoverDistance={setHoverDistM}
            simulation={simulation}
          />

          {/* ERS Energy Telemetry Module */}
          <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-[#1E222B] pb-1.5 mb-1.5">
              <span className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                <Battery className="w-3.5 h-3.5 text-[#FFB300]" strokeWidth={1.5} />
                HYBRID ERS ENERGY TELEMETRY
              </span>
              <span className="text-[10px] text-[#00E5FF] font-bold">
                {era === '2025' ? '4.0 MJ BUDGET (MGU-K)' : '5.4 MJ STORE (ACTIVE REGEN)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[#64748B] block text-[9px] uppercase font-bold">DEPLOYED</span>
                <span className="text-white font-bold tabular">
                  {(simulation.ers.deployedJ / 1e6).toFixed(2)} MJ
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[9px] uppercase font-bold">HARVESTED</span>
                <span className="text-[#00E676] font-bold tabular">
                  {(simulation.ers.harvestedJ / 1e6).toFixed(2)} MJ
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[9px] uppercase font-bold">CLIPPED DIST</span>
                <span className="text-[#FFB300] font-bold tabular">
                  {simulation.ers.clipDistanceM.toFixed(0)} m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: 60% (7 cols): Multi-Channel Oscilloscope */}
        <div className="lg:col-span-7">
          <TelemetryChart
            circuit={circuit}
            simulation={simulation}
            hoverDistanceM={hoverDistM}
            onHoverDistance={setHoverDistM}
          />
        </div>
      </div>
    </div>
  );
}
