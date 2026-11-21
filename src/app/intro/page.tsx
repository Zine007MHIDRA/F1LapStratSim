'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import F1Logo from '../../components/F1Logo';
import { introAudio } from '../../utils/introAudio';
import { 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  ArrowRight,
  Zap,
  Play,
  Sparkles
} from 'lucide-react';

type LogoAnimMode = 'trace' | 'punch' | 'scan';

export default function F1LogoIntroPage() {
  const router = useRouter();
  const [animMode, setAnimMode] = useState<LogoAnimMode>('trace');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [animKey, setAnimKey] = useState<number>(0);
  const [isWarping, setIsWarping] = useState<boolean>(false);

  // Sound helper
  const playSound = (action: () => void) => {
    if (audioEnabled) {
      action();
    }
  };

  // Replay current animation
  const triggerReplay = (mode?: LogoAnimMode) => {
    const nextMode = mode || animMode;
    setAnimKey((prev) => prev + 1);

    if (nextMode === 'punch') {
      playSound(() => introAudio.playRealRev(1.1));
    } else if (nextMode === 'trace') {
      playSound(() => introAudio.playTelemetryPing());
      setTimeout(() => {
        playSound(() => introAudio.playRealRev(0.9));
      }, 700);
    } else if (nextMode === 'scan') {
      playSound(() => introAudio.playRadioSquelch());
    }
  };

  useEffect(() => {
    triggerReplay(animMode);
    return () => {
      introAudio.stopRealRev();
    };
  }, [animMode]);

  // Transition into the telemetry simulator
  const handleLaunchSim = () => {
    if (isWarping) return;
    setIsWarping(true);

    playSound(() => {
      introAudio.playRealFlyby();
    });

    setTimeout(() => {
      router.push('/');
    }, 750);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#06080C] text-[#F8FAFC] overflow-hidden select-none font-sans flex flex-col justify-between">
      
      {/* Background radial carbon glow & speed streaks */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,6,0,0.14)_0%,transparent_65%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#06080C_0%,#030406_100%)] -z-10" />

      {/* Subtle speed lines background grid */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, #1A2336 1px, transparent 1px), linear-gradient(to bottom, #1A2336 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* TOP DIRECTOR'S COMPARISON BAR */}
      <header className="relative z-30 border-b border-[#1A2336]/80 bg-[#0B0F19]/90 backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest text-white uppercase font-mono">
              F1 // LOGO ANIMATION STUDIO
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#1A2336] text-[#94A3B8] font-mono">
            SELECT ANIMATION STYLE
          </span>
        </div>

        {/* Animation Mode Selector Tabs */}
        <div className="flex items-center bg-[#080B12] p-1 rounded-lg border border-[#1A2336]">
          <button
            onClick={() => setAnimMode('trace')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
              animMode === 'trace'
                ? 'bg-[#1A2336] text-[#E10600] shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            1. SPEED STROKE TRACE
          </button>
          <button
            onClick={() => setAnimMode('punch')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
              animMode === 'punch'
                ? 'bg-[#1A2336] text-[#FFB703] shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            2. HYPERSPEED PUNCH
          </button>
          <button
            onClick={() => setAnimMode('scan')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
              animMode === 'scan'
                ? 'bg-[#1A2336] text-[#00F0FF] shadow-sm font-bold'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            3. WIND TUNNEL SCAN
          </button>
        </div>

        {/* Audio Toggle & Quick Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => triggerReplay()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1A2336] bg-[#080B12] hover:bg-[#1A2336] text-xs font-mono text-[#94A3B8] hover:text-white transition-colors"
            title="Replay animation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            REPLAY
          </button>

          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (audioEnabled) introAudio.stopRealRev();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              audioEnabled 
                ? 'bg-[#080B12] border-[#00E676]/40 text-[#00E676]' 
                : 'bg-[#080B12] border-[#1A2336] text-[#64748B]'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {audioEnabled ? 'SOUND ON' : 'MUTED'}
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E10600] hover:bg-[#c20500] text-white font-mono text-xs font-bold transition-all shadow-md"
          >
            SKIP TO SIM
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* CENTER STAGE: ICONIC F1 LOGO */}
      <main 
        onClick={handleLaunchSim}
        className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 cursor-pointer"
        title="Click anywhere to launch simulator"
      >
        <div className={`flex flex-col items-center transition-transform duration-700 ${isWarping ? 'animate-speed-warp' : ''}`}>
          
          {/* Animated F1 Logo */}
          <div key={animKey} className="transform transition-all">
            <F1Logo
              variant={animMode}
              className="w-72 sm:w-96 md:w-[520px] lg:w-[620px] h-20 sm:h-28 md:h-36 lg:h-44"
              glow={true}
            />
          </div>

          {/* Subtitles & Technical Branding */}
          <div className="mt-8 text-center space-y-2 font-mono">
            <div className="text-xs sm:text-sm font-bold tracking-[0.3em] uppercase text-white/90">
              FORMULA 1 // PIT-WALL TELEMETRY
            </div>
            <div className="text-[11px] sm:text-xs text-[#64748B] tracking-[0.2em] uppercase">
              MISSION CONTROL • REAL-TIME GPS & SENSOR TELEMETRY
            </div>
          </div>

          {/* Launch Prompt Button */}
          <div className="mt-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLaunchSim();
              }}
              className="px-8 py-3.5 rounded-xl bg-[#E10600] hover:bg-[#c20500] text-white font-mono text-xs font-bold tracking-widest uppercase transition-all shadow-2xl shadow-[#E10600]/40 flex items-center gap-3 transform hover:scale-105 cursor-pointer ring-1 ring-white/20"
            >
              <Zap className="w-4 h-4 fill-current" />
              LAUNCH SIMULATOR
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[10px] font-mono text-[#64748B] mt-4 tracking-wider">
            CLICK ANYWHERE OR PRESS ENTER TO COMMENCE
          </span>
        </div>
      </main>

      {/* FOOTER BAR */}
      <footer className="relative z-20 border-t border-[#1A2336]/60 bg-[#0B0F19]/60 px-6 py-2.5 flex items-center justify-between text-[11px] font-mono text-[#64748B]">
        <span>OFFICIAL FORMULA 1 LOGO ANIMATION</span>
        <span className="text-[#94A3B8]">NEXT-GEN GPU ACCELERATED SVG MOTION</span>
      </footer>

      {/* SPEED WARP FULL-SCREEN FLASH */}
      {isWarping && (
        <div className="fixed inset-0 z-50 bg-[#06080C] pointer-events-none flex items-center justify-center animate-fade-in">
          <div className="text-center font-mono space-y-2">
            <div className="w-10 h-10 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs tracking-widest text-[#E10600] uppercase font-bold">
              ENGAGING PIT-WALL TELEMETRY...
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
