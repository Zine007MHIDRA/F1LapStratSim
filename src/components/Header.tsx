'use client';

import React from 'react';
import { CIRCUITS_LIST } from '../data/circuits';
import { CircuitData } from '../engine/types';
import { Gauge, Sliders, MapPin, Zap, Activity, ChevronDown } from 'lucide-react';

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
  const currentRoundIndex = CIRCUITS_LIST.findIndex((c) => c.id === currentCircuit.id);
  const roundStr = currentRoundIndex >= 0 ? `R${String(currentRoundIndex + 1).padStart(2, '0')}` : 'GP';

  return (
    <header className="sticky top-2 z-50 px-2 sm:px-4 max-w-7xl mx-auto w-full transition-all">
      <div className="obsidian-card rounded-2xl p-2 sm:p-2.5 backdrop-blur-xl shadow-2xl flex flex-col gap-2">
        {/* Main Command Bar Row */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Left: Brand & Circuit Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* BOX BOX // PIT-WALL Logo with Pulsing Recording Beacon */}
            <div className="flex items-center gap-2 pl-1">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-black text-base sm:text-lg tracking-wider text-white">
                  BOX BOX
                </span>
                <span
                  className="w-2.5 h-2.5 rounded-full bg-[#FF2800] shadow-[0_0_12px_#FF2800] animate-pulse inline-block"
                  title="Live Telemetry Link Active"
                />
              </div>
              <span className="text-[11px] font-mono text-[#64748B] tracking-widest uppercase border-l border-white/10 pl-2">
                PIT-WALL
              </span>
            </div>

            {/* Circuit Selector Island */}
            <div className="relative flex items-center">
              <select
                aria-label="Select Grand Prix Circuit"
                value={currentCircuit.id}
                onChange={(e) => onSelectCircuit(e.target.value)}
                className="bg-[#12151E] text-white border border-white/10 hover:border-white/20 rounded-xl pl-3 pr-8 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-[#FF2800] cursor-pointer transition-all appearance-none shadow-inner"
              >
                {CIRCUITS_LIST.map((c, idx) => (
                  <option key={c.id} value={c.id} className="bg-[#0B0F19] text-white">
                    R{String(idx + 1).padStart(2, '0')} • {c.flag} {c.name} ({c.country})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] absolute right-2.5 pointer-events-none" />
            </div>

            {/* Mini Circuit Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] font-mono text-[#94A3B8]">
              <span className="text-white font-bold">{roundStr}</span>
              <span className="text-white/20">•</span>
              <span>{currentCircuit.direction}</span>
              <span className="text-white/20">•</span>
              <span>{Math.round(currentCircuit.lapLengthM).toLocaleString()}m</span>
            </div>
          </div>

          {/* Center: Floating Navigation Tabs */}
          <nav
            className="flex items-center bg-[#080B12]/80 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full gap-1"
            aria-label="Simulator Navigation"
          >
            {[
              { id: 'simulator', label: 'SIMULATOR', icon: Gauge },
              { id: 'telemetry', label: 'TELEMETRY', icon: Activity },
              { id: 'strategy', label: 'STRATEGY', icon: Sliders },
              { id: 'circuit', label: 'CIRCUIT 3D', icon: MapPin },
              { id: 'regulations', label: '2025 vs 2026', icon: Zap },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id as any)}
                  className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-mono font-bold tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? era === '2026'
                        ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'bg-[#FF2800]/15 text-[#FF2800] border border-[#FF2800]/30 shadow-[0_0_15px_rgba(255,40,0,0.2)]'
                      : 'text-[#64748B] hover:text-[#94A3B8] hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? (era === '2026' ? 'text-[#00F0FF]' : 'text-[#FF2800]') : 'text-[#64748B]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Tactile Regulation Switch & Quick Readout */}
          <div className="flex items-center gap-3">
            {/* Centerpiece Tactile Regulation Switch */}
            <div className="flex items-center bg-[#080B12] p-1 rounded-xl border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => onSelectEra('2025')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                  era === '2025'
                    ? 'bg-[#FF2800] text-white shadow-[0_0_14px_rgba(255,40,0,0.4)]'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                2025 REGS
              </button>
              <button
                type="button"
                onClick={() => onSelectEra('2026')}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                  era === '2026'
                    ? 'bg-[#00F0FF] text-[#050507] shadow-[0_0_14px_rgba(0,240,255,0.4)]'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                <span>2026 ACTIVE AERO</span>
                {era === '2026' && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-black/30 font-black">X/Z</span>
                )}
              </button>
            </div>

            {/* Quick Telemetry Badges */}
            <div className="hidden 2xl:flex items-center gap-3 text-xs font-mono border-l border-white/10 pl-3">
              <div title="Track Surface Temperature">
                <span className="text-[#64748B] text-[10px]">T_TRACK </span>
                <span className="text-white font-bold">{currentCircuit.trackTempC}°C</span>
              </div>
              <div title="Track Altitude">
                <span className="text-[#64748B] text-[10px]">ALT </span>
                <span className="text-white font-bold">{currentCircuit.altitudeM}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
