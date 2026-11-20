'use client';

import React from 'react';
import { CIRCUITS_LIST } from '../data/circuits';
import { CircuitData } from '../engine/types';
import { Gauge, Sliders, MapPin, Zap, Flag, Activity } from 'lucide-react';

interface HeaderProps {
  currentCircuit: CircuitData;
  onSelectCircuit: (id: string) => void;
  era: '2025' | '2026';
  onSelectEra: (era: '2025' | '2026') => void;
  activeTab: 'simulator' | 'telemetry' | 'strategy' | 'circuit' | 'regulations';
  onSelectTab: (tab: 'simulator' | 'telemetry' | 'strategy' | 'circuit' | 'regulations') => void;
}

export default function Header({
  currentCircuit,
  onSelectCircuit,
  era,
  onSelectEra,
  activeTab,
  onSelectTab,
}: HeaderProps) {
  return (
    <header className="border-b border-[#212A3E] bg-[#0E131F]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-3 gap-3">
          {/* Logo & Circuit Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 bg-[#E10600] rounded-sm inline-block"></span>
              <span className="text-xl font-bold tracking-wider text-white">F1SIM</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#212A3E] text-[#00F0FF] font-mono font-medium">
                24/7 EDGE
              </span>
            </div>

            {/* Circuit Selector Dropdown */}
            <div className="relative">
              <select
                aria-label="Select Grand Prix Circuit"
                value={currentCircuit.id}
                onChange={(e) => onSelectCircuit(e.target.value)}
                className="bg-[#141A29] text-[#F1F5F9] border border-[#212A3E] rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-[#E10600] cursor-pointer hover:bg-[#1A2236] transition-colors"
              >
                {CIRCUITS_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Era Toggle (2025 vs 2026) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#141A29] p-1 rounded-md border border-[#212A3E]">
              <button
                type="button"
                onClick={() => onSelectEra('2025')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                  era === '2025'
                    ? 'bg-[#E10600] text-white shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                2025 REGS
              </button>
              <button
                type="button"
                onClick={() => onSelectEra('2026')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                  era === '2026'
                    ? 'bg-[#00F0FF] text-[#080A0F] font-bold shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                2026 ACTIVE AERO
              </button>
            </div>

            {/* Quick Track Telemetry Badges */}
            <div className="hidden lg:flex items-center gap-3 text-xs text-[#94A3B8] mono border-l border-[#212A3E] pl-4">
              <div title="Track & Air Temperature">
                <span className="text-[#64748B]">T_TRACK: </span>
                <span className="text-white font-medium">{currentCircuit.trackTempC}°C</span>
              </div>
              <div title="Track Altitude Above Sea Level">
                <span className="text-[#64748B]">ALT: </span>
                <span className="text-white font-medium">{currentCircuit.altitudeM}m</span>
              </div>
              <div title="Pole Driver Benchmark">
                <span className="text-[#64748B]">POLE: </span>
                <span className="text-[#00F0FF] font-medium">
                  {currentCircuit.poleDriver} {currentCircuit.poleLapTime.toFixed(3)}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-2 md:space-x-6 border-t border-[#212A3E]/60 pt-2 pb-1 overflow-x-auto" aria-label="Simulator Navigation">
          {[
            { id: 'simulator', label: 'SIMULATOR', icon: Gauge },
            { id: 'telemetry', label: 'TELEMETRY COMPARISON', icon: Activity },
            { id: 'strategy', label: 'STRATEGY OPTIMIZER', icon: Sliders },
            { id: 'circuit', label: 'CIRCUIT BLUEPRINT', icon: MapPin },
            { id: 'regulations', label: '2025 vs 2026 REGS', icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-[#E10600] text-white bg-[#141A29]/50 rounded-t'
                    : 'border-transparent text-[#94A3B8] hover:text-white hover:border-[#334155]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E10600]' : 'text-[#64748B]'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
