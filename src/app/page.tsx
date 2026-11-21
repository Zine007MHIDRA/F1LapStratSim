'use client';

import React, { useState, useEffect } from 'react';
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
  const [showIntro, setShowIntro] = useState<boolean>(false);
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

      const hasSeen = sessionStorage.getItem('f1_intro_seen');
      const skipParam = params.get('skipIntro');
      if (!hasSeen && skipParam !== 'true') {
        setShowIntro(true);
      }
    }
  }, []);

  const circuit = getCircuit(circuitId);

  // Default simulation for standalone telemetry tab
  const baseCar = era === '2025' ? car2025(circuit.name, 'qualifying') : car2026(circuit.name, 'qualifying');
  const simulation = simulateLap(circuit, baseCar, { step: 3.0 });

  return (
    <div className="min-h-screen bg-[#050507] canvas-glow text-[#F8FAFC] flex flex-col">
      {/* First-visit F1 Logo Stroke Trace & Team Radio Intro */}
      {showIntro && (
        <F1IntroSplash
          onDismiss={() => {
            setShowIntro(false);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('f1_intro_seen', 'true');
            }
          }}
        />
      )}

      {/* Top Navigation & Circuit Bar */}
      <Header
        currentCircuit={circuit}
        onSelectCircuit={setCircuitId}
        era={era}
        onSelectEra={setEra}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'simulator' && (
          <SimulatorView circuit={circuit} era={era} />
        )}

        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5">
                <TrackMap
                  circuit={circuit}
                  activeDistanceM={hoverDistM}
                  onHoverDistance={setHoverDistM}
                  simulation={simulation}
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

      {/* Footer */}
      <footer className="border-t border-[#1A2336] bg-[#080B12] py-3.5 text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 mono text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] inline-block animate-pulse"></span>
            <span className="text-[#94A3B8]">F1 // PIT-WALL TELEMETRY ENGINE ONLINE</span>
          </div>
          <div>
            FastF1 Ingested Benchmarks • Pirelli Tyre Degradation • FIA Technical Regulations
          </div>
        </div>
      </footer>
    </div>
  );
}
