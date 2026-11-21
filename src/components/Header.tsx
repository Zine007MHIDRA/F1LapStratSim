'use client';

import React, { useMemo } from 'react';
import { CIRCUITS_LIST } from '../data/circuits';
import { CircuitData } from '../engine/types';
import { resolveLiveOrUpcomingWeekend } from '../engine/calendarEngine';
import { Gauge, Activity, Sliders, MapPin, ChevronDown } from 'lucide-react';

interface HeaderProps {
  currentCircuit: CircuitData;
  onSelectCircuit: (id: string) => void;
  era: '2025' | '2026';
  onSelectEra: (era: '2025' | '2026') => void;
  activeTab: 'simulator' | 'telemetry' | 'strategy' | 'circuit' | 'regulations';
  onSelectTab: (tab: 'simulator' | 'telemetry' | 'strategy' | 'circuit' | 'regulations') => void;
  onTriggerIntro?: () => void;
}

const COUNTRY_CODES: Record<string, string> = {
  bahrain: 'BHR',
  jeddah: 'SAU',
  albert_park: 'AUS',
  suzuka: 'JPN',
  shanghai: 'CHN',
  miami: 'USA',
  imola: 'ITA',
  monaco: 'MCO',
  montreal: 'CAN',
  barcelona: 'ESP',
  red_bull_ring: 'AUT',
  silverstone: 'GBR',
  hungaroring: 'HUN',
  spa: 'BEL',
  zandvoort: 'NLD',
  monza: 'ITA',
  baku: 'AZE',
  singapore: 'SGP',
  cota: 'USA',
  mexico_city: 'MEX',
  interlagos: 'BRA',
  las_vegas: 'USA',
  lusail: 'QAT',
  yas_marina: 'ARE',
};

export default function Header({
  currentCircuit,
  onSelectCircuit,
  era,
  onSelectEra,
  activeTab,
  onSelectTab,
  onTriggerIntro,
}: HeaderProps) {
  const currentRoundIndex = CIRCUITS_LIST.findIndex((c) => c.id === currentCircuit.id);
  const liveWeekend = useMemo(() => resolveLiveOrUpcomingWeekend(), []);

  return (
    <header className="sticky top-0 z-50 h-12 w-full bg-[#0D0F13] border-b border-[#1E222B] px-3 flex items-center justify-between select-none font-mono">
      {/* Left: Brand & Circuit Selector */}
      <div className="flex items-center gap-3">
        {/* BOX BOX wordmark with pulsing red status dot */}
        <button
          type="button"
          onClick={onTriggerIntro}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none"
          title="Replay F1 Intro & Team Radio"
        >
          <span className="font-display font-black text-sm tracking-wider text-white">
            BOX BOX
          </span>
          <span
            className="w-2 h-2 rounded-full bg-[#FF2A54] animate-pulse inline-block"
            title="Telemetry Link Active"
          />
        </button>

        <span className="text-[#1E222B]">|</span>

        {/* Compact Circuit Selector Dropdown */}
        <div className="relative flex items-center">
          <select
            aria-label="Select Grand Prix Circuit"
            value={currentCircuit.id}
            onChange={(e) => onSelectCircuit(e.target.value)}
            className="bg-[#14171E] text-white border border-[#1E222B] hover:border-[#2D3340] rounded-[2px] pl-2.5 pr-7 py-1 text-xs font-mono font-bold focus:outline-none focus:border-[#00E5FF] cursor-pointer transition-colors appearance-none"
          >
            {CIRCUITS_LIST.map((c, idx) => {
              const code = COUNTRY_CODES[c.id] || 'F1';
              const isAuto = c.id === liveWeekend.circuitId;
              return (
                <option key={c.id} value={c.id} className="bg-[#0D0F13] text-white">
                  R{String(idx + 1).padStart(2, '0')} • {c.name.toUpperCase()} [{code}]{isAuto ? ' [LIVE]' : ''}
                </option>
              );
            })}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#64748B] absolute right-2 pointer-events-none" />
        </div>
      </div>

      {/* Center: Navigation Tabs (4 Core Engineering Modes) */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Simulator Navigation">
        {[
          { id: 'simulator', label: 'SIMULATOR', icon: Gauge },
          { id: 'telemetry', label: 'TELEMETRY', icon: Activity },
          { id: 'strategy', label: 'STRATEGY', icon: Sliders },
          { id: 'circuit', label: 'CIRCUIT', icon: MapPin },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-1 px-3 rounded-[2px] text-xs font-mono font-bold tracking-wider transition-colors whitespace-nowrap cursor-pointer border ${
                isActive
                  ? era === '2026'
                    ? 'bg-[#14171E] text-[#00E5FF] border-[#00E5FF]'
                    : 'bg-[#14171E] text-[#FF2A54] border-[#FF2A54]'
                  : 'bg-transparent text-[#64748B] border-transparent hover:text-[#94A3B8] hover:bg-[#14171E]/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Single-Line Regulation Toggle & Quick Readout */}
      <div className="flex items-center gap-3">
        {/* Single-Line Regulation Toggle */}
        <div className="flex items-center bg-[#14171E] border border-[#1E222B] rounded-[2px] p-0.5 whitespace-nowrap text-xs font-mono font-bold">
          <button
            type="button"
            onClick={() => onSelectEra('2025')}
            className={`px-2.5 py-1 rounded-[2px] transition-colors cursor-pointer ${
              era === '2025'
                ? 'bg-[#FF2A54] text-white'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            2025 REGS
          </button>
          <button
            type="button"
            onClick={() => onSelectEra('2026')}
            className={`px-2.5 py-1 rounded-[2px] transition-colors cursor-pointer flex items-center gap-1 ${
              era === '2026'
                ? 'bg-[#00E5FF] text-[#07080A]'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}
          >
            <span>2026 ACTIVE AERO</span>
          </button>
        </div>

        {/* Compact T_TRK and ALT Engineering Readouts */}
        <div className="hidden lg:flex items-center gap-2.5 text-[11px] font-mono text-[#64748B] border-l border-[#1E222B] pl-3">
          <div>
            <span>T_TRK </span>
            <span className="text-white font-bold tabular">{currentCircuit.trackTempC}°C</span>
          </div>
          <div>
            <span>ALT </span>
            <span className="text-white font-bold tabular">{currentCircuit.altitudeM}m</span>
          </div>
        </div>
      </div>
    </header>
  );
}
