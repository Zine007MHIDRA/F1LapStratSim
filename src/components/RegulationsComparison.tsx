'use client';

import React from 'react';
import { Zap, Shield, Cpu, Wind, BatteryCharging, Gauge } from 'lucide-react';

export default function RegulationsComparison() {
  const comparisonRows = [
    {
      feature: 'Internal Combustion Engine (ICE)',
      icon: Cpu,
      reg2025: '1.6L Turbo V6 • ~560 kW (750 hp)',
      reg2026: '1.6L Turbo V6 (100% Sustainable Fuel) • ~400 kW (535 hp)',
      delta: '-160 kW (-215 hp) reduction in ICE power',
    },
    {
      feature: 'Hybrid Electric Power (MGU-K)',
      icon: Zap,
      reg2025: '120 kW (160 hp) maximum output',
      reg2026: '350 kW (470 hp) maximum output',
      delta: '+230 kW (+310 hp): almost triple electric boost',
    },
    {
      feature: 'MGU-H (Turbo Heat Recovery)',
      icon: BatteryCharging,
      reg2025: 'Allowed (Unlimited energy refill to battery)',
      reg2026: 'Banned & Removed completely',
      delta: 'No continuous in-lap charging; battery can fully deplete',
    },
    {
      feature: 'Aerodynamic Modes',
      icon: Wind,
      reg2025: 'Fixed wing geometry + Drag Reduction System (DRS)',
      reg2026: 'Active Aerodynamics: Z-Mode (Corners) & X-Mode (Straights)',
      delta: 'Active movable front & rear flaps replace DRS on all straights',
    },
    {
      feature: 'Straightline Clipping Behavior',
      icon: Gauge,
      reg2025: 'Late-lap clipping when 4 MJ regulatory budget is spent',
      reg2026: 'Severe mid-straight clipping when physical SOC drops below 5%',
      delta: 'Requires lift-and-coast harvesting even in qualifying',
    },
    {
      feature: 'Minimum Vehicle Mass',
      icon: Shield,
      reg2025: '798 kg (empty without fuel)',
      reg2026: '768 kg (empty without fuel)',
      delta: '30 kg lighter, enhancing corner agility',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span className="w-2 h-4 bg-[#00F0FF] rounded-xs"></span>
          FIA TECHNICAL REGULATIONS: 2025 vs 2026
        </h2>
        <p className="text-xs text-[#94A3B8] mt-1">
          Detailed vehicle dynamics comparison between current ground-effect aerodynamics and the upcoming 2026 50/50 powertrain shift.
        </p>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2025 Card */}
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#212A3E] pb-3">
            <div>
              <span className="text-xs font-bold text-[#E10600] tracking-wider uppercase">
                CURRENT ERA
              </span>
              <h3 className="text-xl font-bold text-white">2025 Regulations</h3>
            </div>
            <span className="text-xs mono px-2.5 py-1 rounded bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/30 font-bold">
              GROUND EFFECT + DRS
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-[#141A29] p-3 rounded border border-[#212A3E]">
              <span className="text-[#64748B] block font-mono text-[10px]">POWERTRAIN SPLIT</span>
              <div className="text-white font-bold text-sm mt-0.5">82% ICE / 18% Electric</div>
              <p className="text-[#94A3B8] mt-1 text-[11px]">
                The ICE delivers the dominant share of tractive power. The 120 kW MGU-K supplements acceleration until reaching 4 MJ deployment limit.
              </p>
            </div>

            <div className="bg-[#141A29] p-3 rounded border border-[#212A3E]">
              <span className="text-[#64748B] block font-mono text-[10px]">MGU-H STABILIZER</span>
              <div className="text-white font-bold text-sm mt-0.5">Unlimited Continuous Harvest</div>
              <p className="text-[#94A3B8] mt-1 text-[11px]">
                The turbo shaft motor-generator harvests surplus exhaust enthalpy continuously, ensuring battery rarely drops below full capacity on flying laps.
              </p>
            </div>
          </div>
        </div>

        {/* 2026 Card */}
        <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#212A3E] pb-3">
            <div>
              <span className="text-xs font-bold text-[#00F0FF] tracking-wider uppercase">
                NEXT GENERATION
              </span>
              <h3 className="text-xl font-bold text-white">2026 Regulations</h3>
            </div>
            <span className="text-xs mono px-2.5 py-1 rounded bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 font-bold">
              ACTIVE AERO + 350kW MGU-K
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-[#141A29] p-3 rounded border border-[#212A3E]">
              <span className="text-[#64748B] block font-mono text-[10px]">POWERTRAIN SPLIT</span>
              <div className="text-white font-bold text-sm mt-0.5">53% ICE / 47% Electric</div>
              <p className="text-[#94A3B8] mt-1 text-[11px]">
                Nearly 50% of the tractive effort is electric. Acceleration from corner apex is explosive, but straight-line clipping occurs when battery depletes.
              </p>
            </div>

            <div className="bg-[#141A29] p-3 rounded border border-[#212A3E]">
              <span className="text-[#64748B] block font-mono text-[10px]">ACTIVE AERO MODES</span>
              <div className="text-white font-bold text-sm mt-0.5">Dual-Mode Wings (Z & X)</div>
              <p className="text-[#94A3B8] mt-1 text-[11px]">
                Z-Mode engages high downforce for cornering stability. X-Mode sheds front and rear wing angle on straights to compensate for reduced ICE top-end power.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Specification Matrix */}
      <div className="bg-[#0E131F] border border-[#212A3E] rounded-lg p-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#212A3E] pb-2">
          Parametric Physics Comparison
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs mono">
            <thead>
              <tr className="border-b border-[#212A3E] text-[#64748B] uppercase">
                <th className="py-2.5 px-3">Subsystem</th>
                <th className="py-2.5 px-3">2025 Ground Effect</th>
                <th className="py-2.5 px-3">2026 Next-Gen</th>
                <th className="py-2.5 px-3">Dynamics Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#212A3E]/60">
              {comparisonRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <tr key={idx} className="hover:bg-[#141A29] transition-colors">
                    <td className="py-3 px-3 text-white font-medium flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-[#00F0FF]" />
                      {row.feature}
                    </td>
                    <td className="py-3 px-3 text-[#E10600] font-semibold">{row.reg2025}</td>
                    <td className="py-3 px-3 text-[#00F0FF] font-semibold">{row.reg2026}</td>
                    <td className="py-3 px-3 text-[#94A3B8]">{row.delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
