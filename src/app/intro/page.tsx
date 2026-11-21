'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { introAudio } from '../../utils/introAudio';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  RotateCcw, 
  ChevronRight, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Radio, 
  Gauge, 
  ArrowRight,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

type IntroMode = 'boot' | 'lights' | 'cinematic';
type BgImage = 'aero_cfd' | 'night_pitwall' | 'cockpit_hud';

export default function IntroMockupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<IntroMode>('boot');
  const [bg, setBg] = useState<BgImage>('aero_cfd');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [transitioning, setTransitioning] = useState<boolean>(false);

  // Boot Mode States
  const [bootProgress, setBootProgress] = useState<number>(0);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [bootComplete, setBootComplete] = useState<boolean>(false);

  // Lights Mode States
  const [activeLights, setActiveLights] = useState<number>(0);
  const [lightsOut, setLightsOut] = useState<boolean>(false);
  const [lightsRunning, setLightsRunning] = useState<boolean>(false);
  const [lightsReactionTime, setLightsReactionTime] = useState<number | null>(null);
  const lightsStartTimeRef = useRef<number>(0);

  // Background map
  const bgMap: Record<BgImage, string> = {
    aero_cfd: '/intro/aero_cfd.jpg',
    night_pitwall: '/intro/night_pitwall.jpg',
    cockpit_hud: '/intro/cockpit_hud.jpg',
  };

  // Sound helper
  const playSound = (action: () => void) => {
    if (audioEnabled) {
      action();
    }
  };

  // -------------------------------------------------------------
  // MODE 1: BOOT & SYSTEMS CALIBRATION
  // -------------------------------------------------------------
  const startBootSequence = () => {
    setBootProgress(0);
    setBootLogs([]);
    setBootComplete(false);

    const logs = [
      'SYS_INIT: CAN-Bus 2.0B handshake at 1,000 Hz... [OK]',
      'ECU_LINK: Magneti Marelli TAG-320 telemetry gateway connected.',
      'SENSORS: Pirelli infrared tyre carcass thermal array synchronized.',
      'AERO_CFD: 2025/2026 ground effect downforce coefficient matrix loaded.',
      'HYBRID_POWERTRAIN: 1.6L V6 Turbo ICE + 120kW MGU-K online (4.0 MJ SoC).',
      'GPS_CALIBRATION: RTK-differential satellite lock: 0.002m accuracy.',
      'MISSION_CONTROL: Pit-wall engineer stream ready for live telemetry.',
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < logs.length) {
        setBootLogs((prev) => [...prev, logs[current]]);
        setBootProgress(Math.round(((current + 1) / logs.length) * 100));
        playSound(() => introAudio.playTelemetryPing());
        current++;
      } else {
        clearInterval(interval);
        setBootComplete(true);
        playSound(() => introAudio.playRadioSquelch());
      }
    }, 450);
  };

  useEffect(() => {
    if (mode === 'boot') {
      startBootSequence();
    } else {
      introAudio.stopEngine();
    }
  }, [mode]);

  // -------------------------------------------------------------
  // MODE 2: 5 RED LIGHTS & LIGHTS OUT
  // -------------------------------------------------------------
  const startLightsSequence = () => {
    if (lightsRunning) return;
    setLightsRunning(true);
    setActiveLights(0);
    setLightsOut(false);
    setLightsReactionTime(null);

    playSound(() => introAudio.startEngine(4200));

    // Light 1
    setTimeout(() => {
      setActiveLights(1);
      playSound(() => {
        introAudio.playFiaBeep(880);
        introAudio.setRpm(5500, 0.4);
      });
    }, 1000);

    // Light 2
    setTimeout(() => {
      setActiveLights(2);
      playSound(() => {
        introAudio.playFiaBeep(940);
        introAudio.setRpm(7200, 0.4);
      });
    }, 2000);

    // Light 3
    setTimeout(() => {
      setActiveLights(3);
      playSound(() => {
        introAudio.playFiaBeep(1000);
        introAudio.setRpm(9000, 0.4);
      });
    }, 3000);

    // Light 4
    setTimeout(() => {
      setActiveLights(4);
      playSound(() => {
        introAudio.playFiaBeep(1060);
        introAudio.setRpm(11000, 0.4);
      });
    }, 4000);

    // Light 5
    setTimeout(() => {
      setActiveLights(5);
      playSound(() => {
        introAudio.playFiaBeep(1120);
        introAudio.setRpm(12500, 0.3); // rev limiter
      });

      // Random delay between 1.2s and 2.5s before lights out (FIA official regulation)
      const randomHold = 1200 + Math.random() * 1300;
      setTimeout(() => {
        setActiveLights(0);
        setLightsOut(true);
        lightsStartTimeRef.current = performance.now();
        playSound(() => introAudio.playLaunchSnap());
        setLightsRunning(false);
      }, randomHold);
    }, 5000);
  };

  const handleLaunchReaction = () => {
    if (lightsOut && lightsReactionTime === null) {
      const reaction = performance.now() - lightsStartTimeRef.current;
      setLightsReactionTime(reaction);
    }
  };

  // -------------------------------------------------------------
  // TRANSITION TO MAIN SIMULATOR
  // -------------------------------------------------------------
  const triggerTransitionToSim = () => {
    playSound(() => {
      introAudio.playFlyBy();
      introAudio.playRadioSquelch();
    });
    setTransitioning(true);
    setTimeout(() => {
      router.push('/');
    }, 850);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#06080C] text-[#F8FAFC] overflow-hidden select-none font-sans">
      {/* Dynamic Background Image with Depth & Dark Vignette */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105"
        style={{ 
          backgroundImage: `url(${bgMap[bg]})`,
          filter: mode === 'cinematic' ? 'brightness(0.75) contrast(1.15)' : 'brightness(0.4) contrast(1.2)'
        }}
      />
      {/* Carbon fiber grid overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06080C] via-[#06080C]/80 to-[#06080C]/90 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#06080C_95%)] pointer-events-none" />

      {/* TOP DIRECTOR'S COMPARISON DECK */}
      <header className="relative z-30 border-b border-[#1A2336] bg-[#0B0F19]/90 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest text-white uppercase font-mono">
              F1 // INTRO STUDIO MOCKUP
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#1A2336] text-[#94A3B8] font-mono">
            COMPARE 3 STYLES
          </span>
        </div>

        {/* Style Selector Tabs */}
        <div className="flex items-center bg-[#080B12] p-1 rounded-lg border border-[#1A2336]">
          <button
            onClick={() => setMode('boot')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
              mode === 'boot'
                ? 'bg-[#1A2336] text-[#00F0FF] shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            1. SYSTEMS BOOT
          </button>
          <button
            onClick={() => setMode('lights')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
              mode === 'lights'
                ? 'bg-[#1A2336] text-[#E10600] shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            2. 5 RED LIGHTS
          </button>
          <button
            onClick={() => setMode('cinematic')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
              mode === 'cinematic'
                ? 'bg-[#1A2336] text-[#FFB703] shadow-sm'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            3. CINEMATIC PADDOCK
          </button>
        </div>

        {/* Visual Background Selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#64748B]">BG ART:</span>
          <select
            value={bg}
            onChange={(e) => setBg(e.target.value as BgImage)}
            className="bg-[#080B12] border border-[#1A2336] text-white px-2.5 py-1 rounded text-xs focus:outline-none cursor-pointer"
          >
            <option value="aero_cfd">CFD Aero Streamlines</option>
            <option value="night_pitwall">Night Pit-Wall & Brakes</option>
            <option value="cockpit_hud">Cockpit Halo & Wheel</option>
          </select>
        </div>

        {/* Sound & Sim Transition Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (audioEnabled) introAudio.stopEngine();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              audioEnabled 
                ? 'bg-[#080B12] border-[#00E676]/40 text-[#00E676]' 
                : 'bg-[#080B12] border-[#1A2336] text-[#64748B]'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {audioEnabled ? 'AUDIO ON' : 'MUTED'}
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E10600] hover:bg-[#c20500] text-white font-mono text-xs font-bold transition-all shadow-md"
          >
            SKIP TO SIM
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* MAIN PRESENTATION STAGE */}
      <main className="relative z-20 flex flex-col items-center justify-center min-h-[calc(100vh-60px)] p-6">
        
        {/* ============================================================== */}
        {/* OPTION 1: SYSTEMS BOOT & TELEMETRY CALIBRATION                 */}
        {/* ============================================================== */}
        {mode === 'boot' && (
          <div className="w-full max-w-3xl space-y-6 animate-fade-in">
            {/* Header telemetry badge */}
            <div className="flex items-center justify-between border-b border-[#1A2336] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#080B12] border border-[#1A2336] flex items-center justify-center">
                  <Activity className="w-4 h-4 text-[#00F0FF] animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    F1 TELEMETRY DIAGNOSTICS & TELEMETRY BOOT
                  </h1>
                  <p className="text-xs text-[#94A3B8] font-mono">
                    ECU TELEMETRY PROTOCOL v4.28 // FIA MONZA RTK-LOCK
                  </p>
                </div>
              </div>

              <div className="text-right font-mono text-xs">
                <span className="text-[#64748B] block">PROGRESS</span>
                <span className="text-[#00F0FF] font-bold text-sm">{bootProgress}%</span>
              </div>
            </div>

            {/* Terminal Log Console */}
            <div className="bg-[#080B12]/95 border border-[#1A2336] rounded-xl p-5 shadow-2xl font-mono text-xs space-y-2 h-64 overflow-y-auto custom-scrollbar">
              {bootLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[#94A3B8]">
                  <span className="text-[#00F0FF]">{'>'}</span>
                  <span className="leading-relaxed">{log}</span>
                </div>
              ))}
              {bootProgress < 100 && (
                <div className="flex items-center gap-2 text-[#00F0FF] animate-pulse">
                  <span>{'>'}</span>
                  <span>CALIBRATING HARDWARE CHANNELS...</span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                onClick={startBootSequence}
                className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                RE-RUN BOOT PROTOCOL
              </button>

              <button
                onClick={triggerTransitionToSim}
                disabled={!bootComplete}
                className={`px-8 py-3 rounded-xl font-mono font-bold text-sm flex items-center gap-2 transition-all ${
                  bootComplete
                    ? 'bg-[#00F0FF] hover:bg-[#00d0e0] text-[#06080C] shadow-lg shadow-[#00F0FF]/20 cursor-pointer animate-pulse'
                    : 'bg-[#1A2336] text-[#64748B] cursor-not-allowed'
                }`}
              >
                {bootComplete ? (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    ENTER MISSION CONTROL PIT-WALL
                  </>
                ) : (
                  <>SYSTEMS CALIBRATING ({bootProgress}%)...</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* OPTION 2: 5 RED LIGHTS & LIGHTS OUT                            */}
        {/* ============================================================== */}
        {mode === 'lights' && (
          <div className="w-full max-w-2xl text-center space-y-8 animate-fade-in" onClick={handleLaunchReaction}>
            <div>
              <span className="text-xs font-mono tracking-widest text-[#94A3B8] uppercase block mb-2">
                FIA STARTING PROCEDURE
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                GRID DEPARTURE // LIGHTS OUT
              </h1>
            </div>

            {/* Official 5 Red Lights Gantry */}
            <div className="inline-flex items-center gap-4 bg-[#080B12] border-2 border-[#1A2336] rounded-2xl p-6 shadow-2xl">
              {[1, 2, 3, 4, 5].map((lightNum) => {
                const isLit = activeLights >= lightNum;
                return (
                  <div key={lightNum} className="flex flex-col items-center gap-2">
                    {/* Upper red light */}
                    <div 
                      className={`w-12 h-12 rounded-full border-2 transition-all duration-150 ${
                        isLit
                          ? 'bg-[#E10600] border-white shadow-[0_0_35px_#E10600] scale-105'
                          : 'bg-[#1A0505] border-[#2A1010]'
                      }`}
                    />
                    {/* Lower red light */}
                    <div 
                      className={`w-12 h-12 rounded-full border-2 transition-all duration-150 ${
                        isLit
                          ? 'bg-[#E10600] border-white shadow-[0_0_35px_#E10600] scale-105'
                          : 'bg-[#1A0505] border-[#2A1010]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Reaction or Prompt Area */}
            <div className="h-16 flex items-center justify-center">
              {lightsOut && (
                <div className="space-y-1 animate-bounce">
                  <span className="text-2xl font-black font-mono tracking-widest text-[#00E676] block">
                    LIGHTS OUT! GO GO GO!
                  </span>
                  {lightsReactionTime !== null && (
                    <span className="text-sm font-mono text-[#00F0FF]">
                      REACTION TIME: <span className="font-bold text-white">{lightsReactionTime.toFixed(0)} ms</span>
                    </span>
                  )}
                </div>
              )}
              {!lightsOut && lightsRunning && (
                <span className="text-xs font-mono text-[#FFB703] animate-pulse">
                  REV LIMITER ENGAGED • AWAITING LIGHTS OUT...
                </span>
              )}
              {!lightsRunning && !lightsOut && (
                <span className="text-xs font-mono text-[#94A3B8]">
                  Click below to begin the official start countdown.
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={startLightsSequence}
                disabled={lightsRunning}
                className={`px-6 py-3 rounded-xl font-mono text-xs font-bold transition-all ${
                  lightsRunning
                    ? 'bg-[#1A2336] text-[#64748B] cursor-wait'
                    : 'bg-[#E10600] hover:bg-[#c20500] text-white shadow-lg shadow-[#E10600]/25'
                }`}
              >
                {lightsRunning ? 'COUNTDOWN IN PROGRESS...' : 'START 5 RED LIGHTS SEQUENCE'}
              </button>

              <button
                onClick={triggerTransitionToSim}
                className="px-6 py-3 rounded-xl bg-[#080B12] hover:bg-[#1A2336] border border-[#1A2336] font-mono text-xs font-bold text-white transition-all flex items-center gap-2"
              >
                ENTER SIMULATOR
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* OPTION 3: MISSION CONTROL CINEMATIC PADDOCK                     */}
        {/* ============================================================== */}
        {mode === 'cinematic' && (
          <div className="w-full max-w-3xl space-y-8 animate-fade-in">
            {/* Cinematic Title & Super-wide typography */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[#FFB703] uppercase tracking-widest">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                LIVE FROM MONZA AUTODROMO NAZIONALE
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase leading-none">
                FORMULA 1 TELEMETRY // MISSION CONTROL
              </h1>
              <p className="text-sm text-[#94A3B8] max-w-xl font-mono">
                Real-time cornering telemetry, Pirelly tyre degradation modeling, and 2026 active aero aerodynamics simulation.
              </p>
            </div>

            {/* Floating Glassmorphic Telemetry HUD Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#080B12]/80 backdrop-blur-md border border-[#1A2336] rounded-xl p-4 shadow-2xl font-mono text-xs">
              <div className="p-3 bg-[#0B0F19] rounded-lg border border-[#1A2336]/60">
                <span className="text-[#64748B] block text-[10px]">TRACK TEMP</span>
                <span className="text-white font-bold text-sm">42.4 °C</span>
              </div>
              <div className="p-3 bg-[#0B0F19] rounded-lg border border-[#1A2336]/60">
                <span className="text-[#64748B] block text-[10px]">AIR TEMP / HUMIDITY</span>
                <span className="text-white font-bold text-sm">28.1 °C / 54%</span>
              </div>
              <div className="p-3 bg-[#0B0F19] rounded-lg border border-[#1A2336]/60">
                <span className="text-[#64748B] block text-[10px]">WIND SPEED</span>
                <span className="text-[#00F0FF] font-bold text-sm">3.4 m/s HEADWIND</span>
              </div>
              <div className="p-3 bg-[#0B0F19] rounded-lg border border-[#1A2336]/60">
                <span className="text-[#64748B] block text-[10px]">POLE BENCHMARK</span>
                <span className="text-[#00E676] font-bold text-sm">1:18.810 (NOR)</span>
              </div>
            </div>

            {/* Launch Call-to-action */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={triggerTransitionToSim}
                className="px-8 py-4 rounded-xl bg-[#E10600] hover:bg-[#c20500] text-white font-mono font-bold text-sm flex items-center gap-3 transition-all shadow-xl shadow-[#E10600]/30 transform hover:scale-102 cursor-pointer"
              >
                <Gauge className="w-4 h-4" />
                ENTER MISSION CONTROL
              </button>

              <button
                onClick={() => {
                  playSound(() => introAudio.playRadioSquelch());
                }}
                className="px-5 py-4 rounded-xl bg-[#080B12] hover:bg-[#1A2336] border border-[#1A2336] text-white font-mono text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-[#FFB703]" />
                TEST RADIO COMMS
              </button>
            </div>
          </div>
        )}
      </main>

      {/* TRANSITION WARP OVERLAY */}
      {transitioning && (
        <div className="fixed inset-0 z-50 bg-[#06080C] flex flex-col items-center justify-center animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-[#00F0FF] border-t-transparent animate-spin mb-4" />
          <span className="text-sm font-mono tracking-widest text-[#00F0FF] uppercase animate-pulse">
            INITIALIZING PIT-WALL TELEMETRY ENGINE...
          </span>
        </div>
      )}
    </div>
  );
}
