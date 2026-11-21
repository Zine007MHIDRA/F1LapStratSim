'use client';

import React, { useState, useMemo } from 'react';
import { CircuitData, StrategyPlanResult } from '../engine/types';
import { optimizeStrategy, simulateRaceStrategy, TRACK_SC_PROBABILITY } from '../engine/strategyOptimizer';
import { COMPOUNDS } from '../engine/tyreModel';
import { ShieldAlert, AlertCircle, Wind } from 'lucide-react';

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
    <div className="space-y-2 w-full font-mono select-none">
      {/* Configuration Controls Bar */}
      <div className="bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-white flex items-center gap-2 tracking-wider">
              <span className="w-1.5 h-3 bg-[#FF2A54] rounded-[1px]" />
              RACE STRATEGY OPTIMIZER
            </h2>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Combinatorial pit stop search • Pirelli thermal grip decay • ~1.6 kg/lap fuel burn-off
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Total Laps Input */}
            <div className="flex items-center gap-1.5 bg-[#14171E] px-2.5 py-1 rounded-[2px] border border-[#1E222B]">
              <span className="text-[#64748B] text-[10px]">LAPS:</span>
              <input
                type="number"
                min={10}
                max={80}
                value={totalLaps}
                onChange={(e) => setTotalLaps(Math.max(10, Math.min(80, parseInt(e.target.value) || 50)))}
                className="w-10 bg-transparent text-white font-bold focus:outline-none tabular text-xs"
              />
            </div>

            {/* Pit Stop Delta Input */}
            <div className="flex items-center gap-1.5 bg-[#14171E] px-2.5 py-1 rounded-[2px] border border-[#1E222B]">
              <span className="text-[#64748B] text-[10px]">PIT LOSS:</span>
              <input
                type="number"
                step="0.5"
                min={15}
                max={40}
                value={pitLossS}
                onChange={(e) => setPitLossS(parseFloat(e.target.value) || 23.0)}
                className="w-12 bg-transparent text-white font-bold focus:outline-none tabular text-xs"
              />
              <span className="text-[#64748B]">s</span>
            </div>

            {/* Include 2-Stops Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer bg-[#14171E] px-2.5 py-1 rounded-[2px] border border-[#1E222B] hover:border-[#2D3340] transition-colors">
              <input
                type="checkbox"
                checked={include2Stop}
                onChange={(e) => setInclude2Stop(e.target.checked)}
                className="accent-[#FF2A54]"
              />
              <span className="text-white text-[11px]">ALLOW 2-STOP</span>
            </label>
          </div>
        </div>

        {/* Safety Car & Traffic Simulation Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E222B] mt-2.5 pt-2 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FFB300]" strokeWidth={1.5} />
              <span className="text-[#64748B] text-[10px]">CIRCUIT SC PROBABILITY:</span>
              <span className="text-white font-bold tabular">{Math.round(scInfo.scProb * 100)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B] text-[10px]">VSC PROBABILITY:</span>
              <span className="text-[#00E5FF] font-bold tabular">{Math.round(scInfo.vscProb * 100)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dirty Air Wake Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer bg-[#14171E] px-2 py-1 rounded-[2px] border border-[#1E222B] hover:border-[#2D3340] transition-colors">
              <Wind className="w-3 h-3 text-[#64748B]" strokeWidth={1.5} />
              <input
                type="checkbox"
                checked={simulateDirtyAir}
                onChange={(e) => setSimulateDirtyAir(e.target.checked)}
                className="accent-[#FF2A54]"
              />
              <span className="text-white text-[10px]">DIRTY AIR (+1.15s)</span>
            </label>

            {/* Safety Car Lap Trigger */}
            <div className="flex items-center gap-1.5 bg-[#14171E] px-2 py-1 rounded-[2px] border border-[#1E222B] text-xs">
              <span className="text-[#FFB300] text-[10px]">TEST SC LAP:</span>
              <select
                value={scLap ?? ''}
                onChange={(e) => setScLap(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="" className="bg-[#0D0F13] text-white">None (Full Green)</option>
                <option value="15" className="bg-[#0D0F13] text-white">Lap 15</option>
                <option value="22" className="bg-[#0D0F13] text-white">Lap 22</option>
                <option value="30" className="bg-[#0D0F13] text-white">Lap 30</option>
                <option value="38" className="bg-[#0D0F13] text-white">Lap 38</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Leaderboard & Stint Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Left: Ranked Strategy Leaderboard (5 cols) */}
        <div className="lg:col-span-5 bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#1E222B] pb-1.5">
            <span className="text-[11px] font-bold tracking-wider text-[#94A3B8] uppercase">
              RANKED CANDIDATES ({strategies.length})
            </span>
            <span className="text-[10px] text-[#64748B] tabular">
              PIT LOSS: {scLap ? `${(pitLossS * 0.55).toFixed(1)}s (SC)` : `${pitLossS}s`}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
            {strategies.map((strat, idx) => {
              const isSelected = selectedPlanIdx === idx;
              const isOptimal = idx === 0;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPlanIdx(idx)}
                  className={`p-2.5 rounded-[2px] border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#14171E] border-[#00E5FF]'
                      : 'bg-[#0A0C10] border-[#1E222B] hover:border-[#2D3340]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-[1px] ${
                          isOptimal
                            ? 'bg-[#FF2A54] text-white'
                            : 'bg-[#1E2433] text-[#94A3B8]'
                        }`}
                      >
                        #{idx + 1} {isOptimal ? 'OPTIMAL' : ''}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {strat.stopCount}-STOP
                      </span>
                      {strat.pitStopLaps && strat.pitStopLaps.length > 0 && (
                        <span className="text-[10px] text-[#FFB300] tabular">
                          [BOX L{strat.pitStopLaps.join(', L')}]
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white block tabular">
                        {formatRaceTime(strat.totalTime)}
                      </span>
                      <span
                        className={`text-[10px] tabular ${
                          isOptimal ? 'text-[#00E676]' : 'text-[#FFB300]'
                        }`}
                      >
                        {isOptimal ? 'BENCHMARK' : `+${strat.deltaVsBest.toFixed(2)}s`}
                      </span>
                    </div>
                  </div>

                  {/* Stint Compound Sequence */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {strat.plan.map(([c, laps], sIdx) => {
                      const comp = COMPOUNDS[c];
                      return (
                        <React.Fragment key={sIdx}>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded-[1px] text-black flex items-center gap-1 tabular"
                            style={{ backgroundColor: comp.color }}
                          >
                            {c.toUpperCase()} ({laps}L)
                          </span>
                          {sIdx < strat.plan.length - 1 && (
                            <span className="text-[#64748B] text-xs">/</span>
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
        <div className="lg:col-span-7 bg-[#0D0F13] border border-[#1E222B] rounded-[2px] p-3 flex flex-col gap-3">
          <div className="border-b border-[#1E222B] pb-2 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold tracking-wider text-[#94A3B8] uppercase block">
                STRATEGY TIMELINE: #{selectedPlanIdx + 1}
              </span>
              <span className="text-xs text-white font-medium tabular">
                Total Race Time: {activePlan ? formatRaceTime(activePlan.totalTime) : ''}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-[1px] bg-[#14171E] border border-[#1E222B] text-[#00E5FF]">
              {circuit.fullName}
            </span>
          </div>

          {/* Stint Gantt Timeline Bar */}
          {activePlan && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-[#64748B] uppercase">Stint Horizon & Pit Windows</span>
              <div className="w-full h-8 bg-[#07080A] rounded-[2px] flex overflow-hidden border border-[#1E222B]">
                {activePlan.plan.map(([c, laps], idx) => {
                  const comp = COMPOUNDS[c];
                  const pct = (laps / totalLaps) * 100;
                  return (
                    <div
                      key={idx}
                      style={{ width: `${pct}%`, backgroundColor: comp.color }}
                      className="h-full flex items-center justify-center text-black font-bold text-[11px] border-r border-[#07080A]/40 tabular"
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#64748B] uppercase">
                  Lap-by-Lap Degradation Curve
                </span>
                <span className="text-[#94A3B8] tabular">
                  Fuel Burn: ~{(105 / totalLaps).toFixed(2)} kg/lap
                </span>
              </div>

              <div className="h-40 w-full bg-[#07080A] rounded-[2px] border border-[#1E222B] p-2 overflow-hidden flex flex-col justify-end relative">
                <div className="flex items-end h-full gap-0.5">
                  {raceSimulation.lapTimes.map((t, lapIdx) => {
                    const minT = Math.min(...raceSimulation.lapTimes);
                    const maxT = Math.max(...raceSimulation.lapTimes);
                    const normH = Math.max(15, Math.min(100, ((t - minT) / Math.max(1, maxT - minT)) * 85 + 15));
                    
                    return (
                      <div
                        key={lapIdx}
                        className="flex-1 bg-[#00E5FF]/70 hover:bg-white transition-colors"
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
          <div className="bg-[#07080A] border border-[#1E222B] rounded-[2px] p-2.5 text-xs text-[#94A3B8] space-y-1">
            <div className="flex items-center gap-1.5 text-white font-bold text-[11px]">
              <AlertCircle className="w-3 h-3 text-[#FFB300]" strokeWidth={1.5} />
              Strategic Pit Window Insights
            </div>
            <p className="text-[10px]">
              • Degradation rates scaled by circuit tyre stress factor ({circuit.tyreStress}x).
            </p>
            <p className="text-[10px]">
              • Safety Car discount: Pitting under SC/VSC saves ~45% pit loss (~{(pitLossS * 0.45).toFixed(1)}s).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
