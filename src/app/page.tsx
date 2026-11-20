'use client';

import React, { useState } from 'react';
import Header from '../components/Header';
import SimulatorView from '../components/SimulatorView';
import StrategyOptimizerView from '../components/StrategyOptimizerView';
import CircuitBlueprint from '../components/CircuitBlueprint';
import RegulationsComparison from '../components/RegulationsComparison';
import TelemetryChart from '../components/TelemetryChart';
import TrackMap from '../components/TrackMap';
import { getCircuit } from '../data/circuits';
import { car2025, car2026 } from '../engine/carModel';
import { simulateLap } from '../engine/lapSim';

export default function Home() {
  const [circuitId, setCircuitId] = useState<string>('monza');
  const [era, setEra] = useState<'2025' | '2026'>('2025');
  const [activeTab, setActiveTab] = useState<
    'simulator' | 'telemetry' | 'strategy' | 'circuit' | 'regulations'
  >('simulator');
  const [hoverDistM, setHoverDistM] = useState<number>(0);

  const circuit = getCircuit(circuitId);

  // Default simulation for standalone telemetry tab
  const baseCar = era === '2025' ? car2025(circuit.name, 'qualifying') : car2026(circuit.name, 'qualifying');
  const simulation = simulateLap(circuit, baseCar, { step: 3.0 });

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] flex flex-col">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'simulator' && (
          <SimulatorView circuit={circuit} era={era} />
        )}

        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5">
                <TrackMap
                  circuit={circuit}
                  activeDistanceM={hoverDistM}
                  onHoverDistance={setHoverDistM}
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
      <footer className="border-t border-[#212A3E] bg-[#0E131F] py-4 text-xs text-[#94A3B8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E676] inline-block animate-pulse"></span>
            <span>SIMULATION ENGINE ONLINE (24/7 CLIENT-SIDE WASM/TS)</span>
          </div>
          <div>
            FastF1 & OpenF1 Telemetry • Pirelli Tyre Degradation • FIA Technical Regulations
          </div>
        </div>
      </footer>
    </div>
  );
}
