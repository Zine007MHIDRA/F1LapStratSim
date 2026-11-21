'use client';

import React from 'react';
import Link from 'next/link';
import { CIRCUITS_LIST } from '../data/circuits';
import { CircuitData } from '../engine/types';
import { Gauge, Sliders, MapPin, Zap, Activity, Sparkles } from 'lucide-react';

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
    <header className="border-b border-[#1A2336] bg-[#080B12]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-2.5 gap-3">
          {/* Logo & Circuit Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-5 bg-[#E10600] rounded-xs inline-block" />
              <span className="text-base font-black tracking-widest text-white mono">
                F1 // PIT-WALL
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#101524] text-[#94A3B8] border border-[#1A2336] mono font-bold">
                TELEMETRY
              </span>
            </div>

            {/* Circuit Selector Dropdown */}
            <div className="relative">
              <select
                aria-label="Select Grand Prix Circuit"
                value={currentCircuit.id}
                onChange={(e) => onSelectCircuit(e.target.value)}
                className="bg-[#101524] text-white border border-[#1A2336] rounded-md px-3 py-1 text-xs font-bold focus:outline-none focus:border-[#E10600] cursor-pointer hover:bg-[#151C30] transition-colors mono"
              >
                {CIRCUITS_LIST.map((c, idx) => (
                  <option key={c.id} value={c.id}>
                    R{String(idx + 1).padStart(2, '0')} · {c.flag} {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Era Toggle (2025 vs 2026) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#07090E] p-0.5 rounded-md border border-[#1A2336]">
              <button
                type="button"
                onClick={() => onSelectEra('2025')}
                className={`px-3 py-1 text-xs font-bold rounded transition-all mono ${
                  era === '2025'
                    ? 'bg-[#E10600] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                2025 REGS
              </button>
              <button
                type="button"
                onClick={() => onSelectEra('2026')}
                className={`px-3 py-1 text-xs font-bold rounded transition-all mono ${
                  era === '2026'
                    ? 'bg-[#00F0FF] text-[#06080C] shadow-xs'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                2026 ACTIVE AERO
              </button>
            </div>

            {/* Quick Track Telemetry Badges */}
            <div className="hidden lg:flex items-center gap-3 text-xs text-[#94A3B8] mono border-l border-[#1A2336] pl-4">
              <div title="Track Temperature">
                <span className="text-[#64748B]">T_TRACK: </span>
                <span className="text-white font-bold">{currentCircuit.trackTempC}°C</span>
              </div>
              <div title="Track Altitude">
                <span className="text-[#64748B]">ALT: </span>
                <span className="text-white font-bold">{currentCircuit.altitudeM}m</span>
              </div>
              <div title="Pole Benchmark">
                <span className="text-[#64748B]">POLE: </span>
                <span className="text-[#00F0FF] font-bold">
                  {currentCircuit.poleDriver} {currentCircuit.poleLapTime.toFixed(3)}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center justify-between border-t border-[#1A2336]/60 pt-1.5 pb-0.5 overflow-x-auto gap-2" aria-label="Simulator Navigation">
          <div className="flex space-x-1 md:space-x-4">
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
                  className={`flex items-center gap-1.5 py-1.5 px-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-all whitespace-nowrap mono ${
                    isActive
                      ? 'border-[#E10600] text-white bg-[#101524]/60 rounded-t'
                      : 'border-transparent text-[#64748B] hover:text-[#94A3B8] hover:border-[#2A3854]'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${isActive ? 'text-[#E10600]' : 'text-[#64748B]'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <Link
            href="/intro"
            className="flex items-center gap-1.5 py-1 px-2.5 text-[11px] font-bold tracking-wider uppercase border border-[#1A2336] bg-[#080B12] hover:bg-[#1A2336] hover:border-[#00F0FF]/40 text-[#00F0FF] rounded transition-all whitespace-nowrap mono shadow-xs"
            title="Preview and compare intro cinematic styles"
          >
            <Sparkles className="w-3 h-3 text-[#00F0FF]" />
            INTRO STUDIO
          </Link>
        </nav>
      </div>
    </header>
  );
}
