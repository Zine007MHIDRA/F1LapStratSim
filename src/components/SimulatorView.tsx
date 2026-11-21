'use client';

import React, { useState, useMemo } from 'react';
import { CircuitData, CompoundName } from '../engine/types';
import { car2025, car2026 } from '../engine/carModel';
import { simulateLap } from '../engine/lapSim';
import { COMPOUNDS, gripMultiplier } from '../engine/tyreModel';
import TrackMap from './TrackMap';
import TelemetryChart from './TelemetryChart';
import { Gauge, Sliders, Battery, RotateCcw, Award } from 'lucide-react';

interface SimulatorViewProps {
  circuit: CircuitData;
  era: '2025' | '2026';
}

export default function SimulatorView({ circuit, era }: SimulatorViewProps) {
  // Simulator tuning parameters
  const [compound, setCompound] = useState<CompoundName>('soft');
  const [trim, setTrim] = useState<'qualifying' | 'race'>('qualifying');
  const [aeroOffset, setAeroOffset] = useState<number>(0); // -10% to +10% downforce
  const [hoverDistM, setHoverDistM] = useState<number>(0);

  // Derive configured car model
  const car = useMemo(() => {
    const base = era === '2025' ? car2025(circuit.name, trim) : car2026(circuit.name, trim);
    const aeroMult = 1.0 + aeroOffset / 100.0;
    return {
      ...base,
      ClA: base.ClA * aeroMult,
      CdA: base.CdA * (1.0 + (aeroOffset / 100.0) * 0.4), // induced drag follows ClA
      cornerClA: base.cornerClA ? base.cornerClA * aeroMult : undefined,
    };
  }, [era, circuit.name, trim, aeroOffset]);

  // Run physics engine simulation (runs in <2 ms in client browser!)
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

  return (
    <div className="space-y-6">
      {/* Simulation Headline Results Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Lap Time & Delta */}
        <div className="col-span-2 bg-[#0E131F] border border-[#212A3E] rounded-lg p-3.5">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block">
            SIMULATED LAP TIME
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl sm:text-3xl font-bold text-white mono">
              {formatLapTime(simulation.lapTime)}
            </span>
            <span
              className={`text-xs mono font-bold px-1.5 py-0.5 rounded ${
                isFasterThanPole
                  ? 'bg-[#00E676]/20 text-[#00E676]'
                  : 'bg-[#E10600]/20 text-[#E10600]'
              }`}
            >
              {isFasterThanPole ? '' : '+'}
              {poleDelta.toFixed(3)}s vs Pole
            </span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-1 mono">
            Benchmark: {circuit.poleDriver} ({formatLapTime(circuit.poleLapTime)})
          </div>
        </div>

        {/* Speed Trap */}
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-3.5">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block">
            SPEED TRAP V_MAX
          </span>
          <div className="text-xl sm:text-2xl font-bold text-white mono mt-0.5">
            {simulation.speedTrapKmh.toFixed(1)} <span className="text-xs text-[#94A3B8]">km/h</span>
          </div>
          <span className="text-[11px] text-[#00F0FF] mono">
            Real: {circuit.topSpeedKmh} km/h
          </span>
        </div>

        {/* Sector 1 */}
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-3.5">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block">
            SECTOR 1
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#FFB703] mono mt-0.5">
            {simulation.sectorTimes[0].toFixed(3)}s
          </div>
          <span className="text-[11px] text-[#64748B] mono">
            {(simulation.sectorBoundsM[0] / 1000).toFixed(2)} km
          </span>
        </div>

        {/* Sector 2 */}
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-3.5">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block">
            SECTOR 2
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#FFB703] mono mt-0.5">
            {simulation.sectorTimes[1].toFixed(3)}s
          </div>
          <span className="text-[11px] text-[#64748B] mono">
            {((simulation.sectorBoundsM[1] - simulation.sectorBoundsM[0]) / 1000).toFixed(2)} km
          </span>
        </div>

        {/* Sector 3 */}
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-3.5">
          <span className="text-[10px] font-mono uppercase text-[#64748B] block">
            SECTOR 3
          </span>
          <div className="text-xl sm:text-2xl font-bold text-[#FFB703] mono mt-0.5">
            {simulation.sectorTimes[2].toFixed(3)}s
          </div>
          <span className="text-[11px] text-[#64748B] mono">
            {((circuit.lapLengthM - simulation.sectorBoundsM[1]) / 1000).toFixed(2)} km
          </span>
        </div>
      </div>

      {/* Physics & Vehicle Configuration Tuner */}
      <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#E10600]" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              VEHICLE SETUP CONTROLS
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs mono">
            {/* Tyre Compound Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">COMPOUND:</span>
              <div className="flex items-center gap-1">
                {(['soft', 'medium', 'hard', 'inter', 'wet'] as const).map((c) => {
                  const comp = COMPOUNDS[c];
                  const isSel = compound === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCompound(c)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-all ${
                        isSel
                          ? 'text-black shadow-sm'
                          : 'bg-[#141A29] text-[#94A3B8] hover:text-white border border-[#212A3E]'
                      }`}
                      style={{
                        backgroundColor: isSel ? comp.color : undefined,
                      }}
                    >
                      {c[0].toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fuel Trim Mode */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">FUEL LOAD:</span>
              <div className="flex items-center bg-[#141A29] rounded p-0.5 border border-[#212A3E]">
                <button
                  onClick={() => setTrim('qualifying')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    trim === 'qualifying' ? 'bg-[#E10600] text-white' : 'text-[#94A3B8]'
                  }`}
                >
                  QUALI (5kg)
                </button>
                <button
                  onClick={() => setTrim('race')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    trim === 'race' ? 'bg-[#00F0FF] text-black' : 'text-[#94A3B8]'
                  }`}
                >
                  RACE START (105kg)
                </button>
              </div>
            </div>

            {/* Aero Trim Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">AERO TRIM:</span>
              <input
                type="range"
                min={-10}
                max={10}
                step={2}
                value={aeroOffset}
                onChange={(e) => setAeroOffset(parseInt(e.target.value))}
                className="w-20 accent-[#E10600] cursor-pointer"
              />
              <span className="w-10 text-white font-bold text-right">
                {aeroOffset > 0 ? `+${aeroOffset}%` : `${aeroOffset}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual Layout: GPS Map & Telemetry Traces */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: GPS Track Map (5 cols) */}
        <div className="lg:col-span-5">
          <TrackMap
            circuit={circuit}
            activeDistanceM={hoverDistM}
            onHoverDistance={setHoverDistM}
            simulation={simulation}
          />

          {/* ERS Energy Status Card */}
          <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-4 mt-4 text-xs mono">
            <div className="flex items-center justify-between border-b border-[#212A3E] pb-2 mb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-[#FF7A00]" />
                HYBRID ERS ENERGY TELEMETRY
              </span>
              <span className="text-[#FF7A00]">
                {era === '2025' ? '4.0 MJ BUDGET' : '5.4 MJ STORE (SOC LIMITED)'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[#64748B] block text-[10px]">DEPLOYED</span>
                <span className="text-white font-bold">
                  {(simulation.ers.deployedJ / 1e6).toFixed(2)} MJ
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">HARVESTED</span>
                <span className="text-[#00E676] font-bold">
                  {(simulation.ers.harvestedJ / 1e6).toFixed(2)} MJ
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block text-[10px]">CLIPPED DIST</span>
                <span className="text-[#FF7A00] font-bold">
                  {simulation.ers.clipDistanceM.toFixed(0)} m
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Multi-Channel Telemetry Chart (7 cols) */}
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
