'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import SimulatorView from '../components/SimulatorView';
import StrategyOptimizerView from '../components/StrategyOptimizerView';
import CircuitBlueprint from '../components/CircuitBlueprint';
import RegulationsComparison from '../components/RegulationsComparison';
import TelemetryChart from '../components/TelemetryChart';
import TrackMap from '../components/TrackMap';
import F1IntroSplash from '../components/F1IntroSplash';
import { getCircuit } from '../data/circuits';
import { resolveLiveOrUpcomingWeekend } from '../engine/calendarEngine';
import { car2025, car2026 } from '../engine/carModel';
import { simulateLap } from '../engine/lapSim';

export default function Home() {
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [circuitId, setCircuitId] = useState<string>(() => resolveLiveOrUpcomingWeekend().circuitId);
  const [era, setEra] = useState<'2025' | '2026'>('2025');
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'telemetry' | 'strategy' | 'circuit' | 'regulations'
  >('simulator');
  const [hoverDistM, setHoverDistM] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('circuit');
      if (c) {
        setCircuitId(c);
      } else {
        const live = resolveLiveOrUpcomingWeekend();
        setCircuitId(live.circuitId);
      }

      // Allow skipping only if explicitly requested via URL parameter
      if (params.get('skipIntro') === 'true') {
        setShowIntro(false);
      }
    }
  }, []);

  const circuit = useMemo(() => getCircuit(circuitId), [circuitId]);

  // Default simulation for standalone telemetry tab (memoized to prevent re-simulating on tab switches)
  const baseCar = useMemo(() => {
    return era === '2025' ? car2025(circuit.name, 'qualifying') : car2026(circuit.name, 'qualifying');
  }, [circuit.name, era]);

  const simulation = useMemo(() => {
    return simulateLap(circuit, baseCar, { step: 3.0 });
  }, [circuit, baseCar]);

  // Only show the pit-wall application after user presses Enter or dismisses the intro
  if (showIntro) {
    return (
      <F1IntroSplash
        onDismiss={() => {
          setShowIntro(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07080A] text-[#F8FAFC] flex flex-col w-full max-w-full">
      {/* Top Single-Row 48px Command Navbar */}
      <Header
        currentCircuit={circuit}
        onSelectCircuit={setCircuitId}
        era={era}
        onSelectEra={setEra}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onTriggerIntro={() => setShowIntro(true)}
      />

      {/* Full-Bleed Utilitarian Main Workspace (8px Gaps) */}
      <main className="flex-1 w-full max-w-full p-2">
        {activeTab === 'simulator' && (
          <SimulatorView circuit={circuit} era={era} />
        )}

        {activeTab === 'telemetry' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start w-full">
            <div className="lg:col-span-5">
              <TrackMap
                circuit={circuit}
                activeDistanceM={hoverDistM}
                onHoverDistance={setHoverDistM}
                simulation={simulation}
                era={era}
              />
            </div>
            <div className="lg:col-span-7">
              <TelemetryChart
                circuit={circuit}
                simulation={simulation}
                hoverDistanceM={hoverDistM}
                onHoverDistance={setHoverDistM}
              />
            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
          <StrategyOptimizerView circuit={circuit} />
        )}

        {activeTab === 'circuit' && (
          <CircuitBlueprint circuit={circuit} />
        )}

        {activeTab === 'regulations' && (
          <RegulationsComparison />
        )}
      </main>

      {/* Engineering Footer Bar */}
      <footer className="border-t border-[#1E222B] bg-[#0D0F13] h-8 px-3 text-xs text-[#64748B] flex items-center justify-between mono text-[10px] w-full">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] inline-block animate-pulse" />
          <span className="text-[#94A3B8] font-bold">BOX BOX TELEMETRY ONLINE</span>
          <span className="text-[#3E485B]">|</span>
          <span>100Hz CAN-BUS LINK</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[#64748B]">
          <span>FastF1 Ingested Benchmarks</span>
          <span>•</span>
          <span>Pirelli Tyre Model</span>
          <span>•</span>
          <span>FIA Technical Regulations</span>
        </div>
      </footer>
    </div>
  );
}
