'use client';

import React from 'react';
import { CircuitData } from '../engine/types';
import { MapPin, Flag, Compass, Gauge, Activity } from 'lucide-react';

interface CircuitBlueprintProps {
  circuit: CircuitData;
}

export default function CircuitBlueprint({ circuit }: CircuitBlueprintProps) {
  const corners = circuit.segments.filter((s) => s.kind === 'corner');
  const straights = circuit.segments.filter((s) => s.kind === 'straight');

  return (
    <div className="space-y-2 w-full font-mono select-none">
      {/* Circuit Header Card */}
      <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-[1px] bg-[#14171E] border border-[#1E222B] text-white text-xs font-bold">
                FIA
              </span>
              <div>
                <h1 className="text-base font-bold text-white tracking-wider uppercase">
                  {circuit.fullName}
                </h1>
                <p className="text-[11px] text-[#94A3B8] flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-[#FF2A54]" strokeWidth={1.5} />
                  {circuit.location}, {circuit.country} • Direction: {circuit.direction}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-[#64748B] mt-2 max-w-3xl leading-relaxed">
              {circuit.characteristics}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#07080A] p-2 rounded-[2px] border border-[#1E222B] text-xs">
            <div>
              <span className="text-[#64748B] block text-[9px] uppercase font-bold">LAP LENGTH</span>
              <span className="text-white font-bold text-xs tabular">{Math.round(circuit.lapLengthM).toLocaleString()} m</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[9px] uppercase font-bold">RACE LAPS</span>
              <span className="text-white font-bold text-xs tabular">{circuit.raceLaps} Laps</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[9px] uppercase font-bold">ALTITUDE</span>
              <span className="text-white font-bold text-xs tabular">{circuit.altitudeM} m</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[9px] uppercase font-bold">TYRE STRESS</span>
              <span className="text-[#FFB300] font-bold text-xs tabular">{circuit.tyreStress}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* Circuit Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[10px]">FastF1 Pole Benchmark</span>
            <Flag className="w-3.5 h-3.5 text-[#FF2A54]" strokeWidth={1.5} />
          </div>
          <div className="text-xl font-bold text-white tabular">
            {circuit.poleLapTime.toFixed(3)}s
          </div>
          <div className="text-[11px] text-[#00E5FF] mt-0.5 font-bold">
            Set by {circuit.poleDriver}
          </div>
          <p className="text-[10px] text-[#64748B] mt-1.5">
            Official qualifying benchmark ingested directly from timing telemetry.
          </p>
        </div>

        <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[10px]">Speed Trap Peak</span>
            <Gauge className="w-3.5 h-3.5 text-[#00E5FF]" strokeWidth={1.5} />
          </div>
          <div className="text-xl font-bold text-white tabular">
            {circuit.topSpeedKmh.toFixed(1)} km/h
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-0.5 tabular">
            Longest straight: {Math.round(Math.max(...straights.map((s) => s.length))).toLocaleString()}m
          </div>
          <p className="text-[10px] text-[#64748B] mt-1.5">
            Aero downforce configuration calibrated to achieve this top speed.
          </p>
        </div>

        <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1.5">
            <span className="font-bold uppercase tracking-wider text-[10px]">Pit Lane Loss</span>
            <Activity className="w-3.5 h-3.5 text-[#FFB300]" strokeWidth={1.5} />
          </div>
          <div className="text-xl font-bold text-white tabular">
            {circuit.pitLossS.toFixed(1)}s
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-0.5 tabular">
            Stationary stop: ~2.4s • Delta: ~{(circuit.pitLossS - 2.4).toFixed(1)}s
          </div>
          <p className="text-[10px] text-[#64748B] mt-1.5">
            Time lost relative to staying at full racing speed on track.
          </p>
        </div>
      </div>

      {/* Turn-by-Turn Engineering Breakdown Table */}
      <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3">
        <div className="flex items-center justify-between mb-2.5 border-b border-[#1E222B] pb-2">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-[#00E5FF]" strokeWidth={1.5} />
            Turn-by-Turn Geometric Profile ({circuit.segments.length} Segments)
          </h2>
          <span className="text-[11px] text-[#64748B]">
            {corners.length} Corners • {straights.length} Straights
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E222B] text-[#64748B] uppercase text-[9px]">
                <th className="py-1.5 px-2.5">Segment Name</th>
                <th className="py-1.5 px-2.5">Kind</th>
                <th className="py-1.5 px-2.5">Length</th>
                <th className="py-1.5 px-2.5">Corner Radius</th>
                <th className="py-1.5 px-2.5">Direction</th>
                <th className="py-1.5 px-2.5">DRS Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222B]/60">
              {circuit.segments.map((seg, idx) => (
                <tr key={idx} className="hover:bg-[#14171E] transition-colors">
                  <td className="py-1.5 px-2.5 text-white font-medium">{seg.name}</td>
                  <td className="py-1.5 px-2.5">
                    <span
                      className={`px-1.5 py-0.2 rounded-[1px] text-[9px] font-bold ${
                        seg.kind === 'corner'
                          ? 'bg-[#FF2A54]/15 text-[#FF2A54] border border-[#FF2A54]/30'
                          : 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                      }`}
                    >
                      {seg.kind.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-1.5 px-2.5 text-[#94A3B8] tabular">{seg.length.toFixed(1)} m</td>
                  <td className="py-1.5 px-2.5 text-white tabular">
                    {seg.radius > 0 ? `${seg.radius.toFixed(0)} m` : 'N/A'}
                  </td>
                  <td className="py-1.5 px-2.5 text-[#94A3B8]">
                    {seg.direction === 1 ? 'Right' : seg.direction === -1 ? 'Left' : 'Straight'}
                  </td>
                  <td className="py-1.5 px-2.5">
                    {seg.drs ? (
                      <span className="px-1.5 py-0.2 rounded-[1px] text-[9px] font-bold bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30">
                        DRS ACTIVE
                      </span>
                    ) : (
                      <span className="text-[#64748B]">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
