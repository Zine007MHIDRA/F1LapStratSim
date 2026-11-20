'use client';

import React, { useState, useMemo } from 'react';
import { CircuitData, StrategyPlanResult } from '../engine/types';
import { optimizeStrategy, simulateRaceStrategy, TRACK_SC_PROBABILITY } from '../engine/strategyOptimizer';
import { COMPOUNDS } from '../engine/tyreModel';
import { ShieldAlert, AlertCircle, Wind, Sparkles } from 'lucide-react';

interface StrategyOptimizerViewProps {
  circuit: CircuitData;
}

export default function StrategyOptimizerView({ circuit }: StrategyOptimizerViewProps) {
  const [totalLaps, setTotalLaps] = useState<number>(circuit.raceLaps || 53);
  const [pitLossS, setPitLossS] = useState<number>(circuit.pitLossS || 23.0);
  const [include2Stop, setInclude2Stop] = useState<boolean>(true);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState<number>(0);
  const [scLap, setScLap] = useState<number | null>(null);
  const [simulateDirtyAir, setSimulateDirtyAir] = useState<boolean>(false);

  // Circuit Safety Car Risk
  const scInfo = TRACK_SC_PROBABILITY[circuit.id.toLowerCase()] || { scProb: 0.40, vscProb: 0.40 };

  // Compute optimized strategies
  const strategies: StrategyPlanResult[] = useMemo(() => {
    return optimizeStrategy(circuit, totalLaps, include2Stop, 15, {
      scLap: scLap ?? undefined,
      dirtyAirLaps: simulateDirtyAir ? 12 : 0,
    });
  }, [circuit, totalLaps, include2Stop, scLap, simulateDirtyAir]);

  // Selected strategy detailed race breakdown
  const activePlan = strategies[selectedPlanIdx] || strategies[0];
  const raceSimulation = useMemo(() => {
    if (!activePlan) return null;
    const stints = activePlan.plan.map(([c, laps]) => ({ compound: c, laps }));
    return simulateRaceStrategy(circuit, stints, {
      pitLossS,
      step: 15.0,
      scLap: scLap ?? undefined,
      dirtyAirLaps: simulateDirtyAir ? 12 : 0,
    });
  }, [circuit, activePlan, pitLossS, scLap, simulateDirtyAir]);

  const formatRaceTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${hours > 0 ? `${hours}h ` : ''}${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Configuration Controls Bar */}
      <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-4 bg-[#E10600] rounded-xs"></span>
              RACE STRATEGY OPTIMIZER
            </h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Combinatorial pit stop search with Pirelli thermal grip decay and ~1.6 kg/lap fuel burn-off.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs mono">
            {/* Total Laps Input */}
            <div className="flex items-center gap-2 bg-[#141A29] px-3 py-1.5 rounded border border-[#212A3E]">
              <span className="text-[#64748B]">RACE LAPS:</span>
              <input
                type="number"
                min={10}
                max={80}
                value={totalLaps}
                onChange={(e) => setTotalLaps(Math.max(10, Math.min(80, parseInt(e.target.value) || 50)))}
                className="w-12 bg-transparent text-white font-bold focus:outline-none"
              />
            </div>

            {/* Pit Stop Delta Input */}
            <div className="flex items-center gap-2 bg-[#141A29] px-3 py-1.5 rounded border border-[#212A3E]">
              <span className="text-[#64748B]">PIT LOSS:</span>
              <input
                type="number"
                step="0.5"
                min={15}
                max={40}
                value={pitLossS}
                onChange={(e) => setPitLossS(parseFloat(e.target.value) || 23.0)}
                className="w-14 bg-transparent text-white font-bold focus:outline-none"
              />
              <span className="text-[#64748B]">s</span>
            </div>

            {/* Include 2-Stops Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer bg-[#141A29] px-3 py-1.5 rounded border border-[#212A3E] hover:border-[#334155]">
              <input
                type="checkbox"
                checked={include2Stop}
                onChange={(e) => setInclude2Stop(e.target.checked)}
                className="rounded accent-[#E10600]"
              />
              <span className="text-white">ALLOW 2-STOP</span>
            </label>
          </div>
        </div>

        {/* Safety Car & Traffic Simulation Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#212A3E] mt-4 pt-3 text-xs mono">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FFB703]" />
              <span className="text-[#64748B]">CIRCUIT SC PROBABILITY:</span>
              <span className="text-white font-bold">{Math.round(scInfo.scProb * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">VSC PROBABILITY:</span>
              <span className="text-[#00F0FF] font-bold">{Math.round(scInfo.vscProb * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Dirty Air Wake Toggle */}
            <label className="flex items-center gap-2 cursor-pointer bg-[#141A29] px-2.5 py-1 rounded border border-[#212A3E]">
              <Wind className="w-3.5 h-3.5 text-[#64748B]" />
              <input
                type="checkbox"
                checked={simulateDirtyAir}
                onChange={(e) => setSimulateDirtyAir(e.target.checked)}
                className="rounded accent-[#E10600]"
              />
              <span className="text-white">DIRTY AIR TRAFFIC (+1.15s)</span>
            </label>

            {/* Safety Car Lap Trigger */}
            <div className="flex items-center gap-2 bg-[#141A29] px-2.5 py-1 rounded border border-[#212A3E]">
              <span className="text-[#FFB703]">TEST SC ON LAP:</span>
              <select
                value={scLap ?? ''}
                onChange={(e) => setScLap(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-[#141A29] text-white">None (Full Green)</option>
                <option value="15" className="bg-[#141A29] text-white">Lap 15</option>
                <option value="22" className="bg-[#141A29] text-white">Lap 22</option>
                <option value="30" className="bg-[#141A29] text-white">Lap 30</option>
                <option value="38" className="bg-[#141A29] text-white">Lap 38</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Leaderboard & Stint Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Ranked Strategy Leaderboard (5 cols) */}
        <div className="lg:col-span-5 bg-[#0E131F] border border-[#212A3E] rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#212A3E] pb-2">
            <span className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase">
              RANKED CANDIDATES ({strategies.length})
            </span>
            <span className="text-[11px] mono text-[#64748B]">
              PIT LOSS: {scLap ? `${(pitLossS * 0.55).toFixed(1)}s (SC)` : `${pitLossS}s`}
            </span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {strategies.map((strat, idx) => {
              const isSelected = selectedPlanIdx === idx;
              const isOptimal = idx === 0;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPlanIdx(idx)}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#141A29] border-[#E10600] shadow-md'
                      : 'bg-[#101624] border-[#212A3E] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isOptimal
                            ? 'bg-[#E10600] text-white'
                            : 'bg-[#212A3E] text-[#94A3B8]'
                        }`}
                      >
                        #{idx + 1} {isOptimal ? 'OPTIMAL' : ''}
                      </span>
                      <span className="text-xs mono font-semibold text-white">
                        {strat.stopCount}-STOP
                      </span>
                      {strat.pitStopLaps && strat.pitStopLaps.length > 0 && (
                        <span className="text-[10px] mono text-[#FFB703]">
                          [BOX L{strat.pitStopLaps.join(', L')}]
                        </span>
                      )}
                    </div>
                    <div className="text-right mono">
                      <span className="text-xs font-bold text-white block">
                        {formatRaceTime(strat.totalTime)}
                      </span>
                      <span
                        className={`text-[10px] ${
                          isOptimal ? 'text-[#00E676]' : 'text-[#FF7A00]'
                        }`}
                      >
                        {isOptimal ? 'BENCHMARK' : `+${strat.deltaVsBest.toFixed(2)}s`}
                      </span>
                    </div>
                  </div>

                  {/* Stint Compound Sequence */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {strat.plan.map(([c, laps], sIdx) => {
                      const comp = COMPOUNDS[c];
                      return (
                        <React.Fragment key={sIdx}>
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded text-black flex items-center gap-1"
                            style={{ backgroundColor: comp.color }}
                          >
                            {c.toUpperCase()} ({laps}L)
                          </span>
                          {sIdx < strat.plan.length - 1 && (
                            <span className="text-[#64748B] text-xs font-mono">/</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Stint Breakdown & Lap Timeline (7 cols) */}
        <div className="lg:col-span-7 bg-[#0E131F] border border-[#212A3E] rounded-lg p-4 flex flex-col gap-4">
          <div className="border-b border-[#212A3E] pb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#94A3B8] uppercase block">
                STRATEGY TIMELINE: #{selectedPlanIdx + 1}
              </span>
              <span className="text-xs mono text-white font-medium">
                Total Race Time: {activePlan ? formatRaceTime(activePlan.totalTime) : ''}
              </span>
            </div>
            <span className="text-xs mono px-2.5 py-1 rounded bg-[#141A29] border border-[#212A3E] text-[#00F0FF]">
              {circuit.fullName}
            </span>
          </div>

          {/* Stint Gantt Timeline Bar */}
          {activePlan && (
            <div className="space-y-2">
              <span className="text-[11px] mono text-[#64748B] uppercase">Stint Horizon & Pit Windows</span>
              <div className="w-full h-10 bg-[#141A29] rounded flex overflow-hidden border border-[#212A3E]">
                {activePlan.plan.map(([c, laps], idx) => {
                  const comp = COMPOUNDS[c];
                  const pct = (laps / totalLaps) * 100;
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%`, backgroundColor: comp.color }}
                      className="h-full flex items-center justify-center text-black font-bold text-xs border-r border-[#080A0F]/30"
                      title={`${c.toUpperCase()} Stint: ${laps} laps`}
                    >
                      {c.toUpperCase()} ({laps}L)
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lap-by-Lap Time Curve */}
          {raceSimulation && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] mono text-[#64748B] uppercase">
                  Lap-by-Lap Degradation Curve
                </span>
                <span className="text-[11px] mono text-[#94A3B8]">
                  Fuel Burn: ~{(105 / totalLaps).toFixed(2)} kg/lap
                </span>
              </div>

              <div className="h-44 w-full bg-[#141A29] rounded border border-[#212A3E] p-2 overflow-hidden flex flex-col justify-end relative">
                {/* Visual sparkline of lap times */}
                <div className="flex items-end h-full gap-0.5">
                  {raceSimulation.lapTimes.map((t, lapIdx) => {
                    const minT = Math.min(...raceSimulation.lapTimes);
                    const maxT = Math.max(...raceSimulation.lapTimes);
                    const normH = Math.max(15, Math.min(100, ((t - minT) / Math.max(1, maxT - minT)) * 85 + 15));
                    
                    return (
                      <div
                        key={lapIdx}
                        className="flex-1 bg-[#00F0FF] hover:bg-white rounded-t-xs transition-colors"
                        style={{ height: `${normH}%` }}
                        title={`Lap ${lapIdx + 1}: ${t.toFixed(3)}s (Fuel: ${raceSimulation.fuelMass[lapIdx].toFixed(1)}kg)`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Strategy Technical Notes */}
          <div className="bg-[#141A29] border border-[#212A3E] rounded p-3 text-xs text-[#94A3B8] space-y-1.5">
            <div className="flex items-center gap-2 text-white font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-[#FFB703]" />
              Strategic Pit Window Insights
            </div>
            <p>
              • Degradation rates are scaled by the circuit tyre stress factor ({circuit.tyreStress}x).
            </p>
            <p>
              • Safety Car discount: Pitting under an active SC or VSC saves ~45% of the pit loss (~{(pitLossS * 0.45).toFixed(1)}s), vaulting multi-stop aggressive runners ahead of conservation plans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
