'use client';

import React from 'react';
import { CircuitData } from '../engine/types';
import { MapPin, Wind, Flag, Compass, Gauge, Activity } from 'lucide-react';

interface CircuitBlueprintProps {
  circuit: CircuitData;
}

export default function CircuitBlueprint({ circuit }: CircuitBlueprintProps) {
  const corners = circuit.segments.filter((s) => s.kind === 'corner');
  const straights = circuit.segments.filter((s) => s.kind === 'straight');

  return (
    <div className="space-y-6">
      {/* Circuit Header Card */}
      <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{circuit.flag}</span>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">
                  {circuit.fullName}
                </h1>
                <p className="text-xs text-[#94A3B8] flex items-center gap-2 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E10600]" />
                  {circuit.location}, {circuit.country} • Direction: {circuit.direction}
                </p>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8] mt-3 max-w-3xl leading-relaxed">
              {circuit.characteristics}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#141A29] p-3 rounded border border-[#212A3E] text-xs mono">
            <div>
              <span className="text-[#64748B] block text-[10px]">LAP LENGTH</span>
              <span className="text-white font-bold text-sm">{circuit.lapLengthM} m</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px]">RACE LAPS</span>
              <span className="text-white font-bold text-sm">{circuit.raceLaps} Laps</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px]">ALTITUDE</span>
              <span className="text-white font-bold text-sm">{circuit.altitudeM} m</span>
            </div>
            <div>
              <span className="text-[#64748B] block text-[10px]">TYRE STRESS</span>
              <span className="text-[#FFB703] font-bold text-sm">{circuit.tyreStress}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* Circuit Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
            <span className="font-bold uppercase tracking-wider">FastF1 Pole Benchmark</span>
            <Flag className="w-3.5 h-3.5 text-[#E10600]" />
          </div>
          <div className="text-2xl font-bold text-white mono">
            {circuit.poleLapTime.toFixed(3)}s
          </div>
          <div className="text-xs text-[#00F0FF] mt-1 mono font-medium">
            Set by {circuit.poleDriver}
          </div>
          <p className="text-[11px] text-[#64748B] mt-2">
            Official qualifying benchmark ingested directly from timing telemetry.
          </p>
        </div>

        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
            <span className="font-bold uppercase tracking-wider">Speed Trap Peak</span>
            <Gauge className="w-3.5 h-3.5 text-[#00F0FF]" />
          </div>
          <div className="text-2xl font-bold text-white mono">
            {circuit.topSpeedKmh.toFixed(1)} km/h
          </div>
          <div className="text-xs text-[#94A3B8] mt-1 mono">
            Longest straight: {Math.max(...straights.map((s) => s.length))}m
          </div>
          <p className="text-[11px] text-[#64748B] mt-2">
            Aero downforce configuration calibrated to achieve this top speed.
          </p>
        </div>

        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
            <span className="font-bold uppercase tracking-wider">Pit Lane Loss</span>
            <Activity className="w-3.5 h-3.5 text-[#FFB703]" />
          </div>
          <div className="text-2xl font-bold text-white mono">
            {circuit.pitLossS.toFixed(1)}s
          </div>
          <div className="text-xs text-[#94A3B8] mt-1 mono">
            Stationary stop: ~2.4s • Delta: ~{(circuit.pitLossS - 2.4).toFixed(1)}s
          </div>
          <p className="text-[11px] text-[#64748B] mt-2">
            Time lost relative to staying at full racing speed on track.
          </p>
        </div>
      </div>

      {/* Turn-by-Turn Engineering Breakdown Table */}
      <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4 border-b border-[#212A3E] pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#E10600]" />
            Turn-by-Turn Geometric Profile ({circuit.segments.length} Segments)
          </h2>
          <span className="text-xs mono text-[#94A3B8]">
            {corners.length} Corners • {straights.length} Straights
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs mono">
            <thead>
              <tr className="border-b border-[#212A3E] text-[#64748B] uppercase">
                <th className="py-2 px-3">Segment Name</th>
                <th className="py-2 px-3">Kind</th>
                <th className="py-2 px-3">Length</th>
                <th className="py-2 px-3">Corner Radius</th>
                <th className="py-2 px-3">Direction</th>
                <th className="py-2 px-3">DRS Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#212A3E]/60">
              {circuit.segments.map((seg, idx) => (
                <tr key={idx} className="hover:bg-[#141A29] transition-colors">
                  <td className="py-2.5 px-3 text-white font-medium">{seg.name}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        seg.kind === 'corner'
                          ? 'bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/30'
                          : 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30'
                      }`}
                    >
                      {seg.kind.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#94A3B8]">{seg.length.toFixed(1)} m</td>
                  <td className="py-2.5 px-3 text-white">
                    {seg.radius > 0 ? `${seg.radius.toFixed(0)} m` : 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-[#94A3B8]">
                    {seg.direction === 1 ? 'Right' : seg.direction === -1 ? 'Left' : 'Straight'}
                  </td>
                  <td className="py-2.5 px-3">
                    {seg.drs ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/30">
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
