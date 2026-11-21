'use client';

import React, { useState, useEffect } from 'react';
import F1Logo from './F1Logo';
import { introAudio } from '../utils/introAudio';
import { Volume2, VolumeX, ArrowRight, Zap, Radio, X } from 'lucide-react';

interface F1IntroSplashProps {
  onDismiss: () => void;
  autoDismissMs?: number;
}

export default function F1IntroSplash({ onDismiss, autoDismissMs }: F1IntroSplashProps) {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [isWarping, setIsWarping] = useState<boolean>(false);

  useEffect(() => {
    // Play authentic F1 Team Radio on intro activation
    try {
      introAudio.playF1RadioSound();
    } catch {}

    // Optional auto-dismiss if specified
    let timer: NodeJS.Timeout | null = null;
    if (autoDismissMs) {
      timer = setTimeout(() => {
        handleLaunch();
      }, autoDismissMs);
    }

    // Keyboard trigger (Enter, Space, or ESC)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        instantSkip();
      } else if (e.key === 'Enter' || e.key === ' ') {
        handleLaunch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      introAudio.stopF1RadioSound();
    };
  }, []);

  const handleLaunch = () => {
    if (isWarping) return;
    setIsWarping(true);

    if (audioEnabled) {
      try {
        introAudio.playRealFlyby();
      } catch {}
    }

    setTimeout(() => {
      onDismiss();
    }, 750);
  };

  const instantSkip = () => {
    introAudio.stopF1RadioSound();
    onDismiss();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-[#06080C] text-[#F8FAFC] select-none flex flex-col justify-between overflow-hidden"
      onClick={handleLaunch}
    >
      {/* Background radial carbon glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,6,0,0.18)_0%,transparent_65%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#06080C_0%,#030406_100%)] -z-10" />

      {/* Subtle speed lines background grid */}
      <div 
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, #1A2336 1px, transparent 1px), linear-gradient(to bottom, #1A2336 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Top action row */}
      <div className="relative z-20 flex items-center justify-between p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse"></span>
          <span className="text-xs font-mono font-bold tracking-widest text-white uppercase">
            F1 // PIT-WALL TELEMETRY
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (audioEnabled) {
                introAudio.stopF1RadioSound();
              } else {
                introAudio.playF1RadioSound();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
              audioEnabled 
                ? 'bg-[#080B12] border-[#00E676]/40 text-[#00E676]' 
                : 'bg-[#080B12] border-[#1A2336] text-[#64748B]'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {audioEnabled ? 'RADIO ON' : 'MUTED'}
          </button>

          <button
            onClick={instantSkip}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#080B12] hover:bg-[#1A2336] border border-[#1A2336] text-[#94A3B8] hover:text-white text-xs font-mono transition-colors cursor-pointer"
          >
            <span>SKIP (ESC)</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Stage: F1 Logo Stroke Trace Animation */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 cursor-pointer">
        <div className={`flex flex-col items-center transition-transform duration-700 ${isWarping ? 'animate-speed-warp' : ''}`}>
          
          {/* Official F1 Logo with stroke trace */}
          <div className="transform transition-all">
            <F1Logo
              variant="trace"
              className="w-72 sm:w-96 md:w-[540px] lg:w-[640px] h-20 sm:h-28 md:h-36 lg:h-44"
              glow={true}
            />
          </div>

          {/* Radio Status Chip */}
          <div className="mt-8 flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1A2336]/80 border border-[#00E676]/40 text-[#00E676] text-xs font-mono font-bold animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            <span>F1 PIT-WALL TEAM RADIO ACTIVE</span>
          </div>

          {/* Subtitles & Branding */}
          <div className="mt-4 text-center space-y-1.5 font-mono">
            <div className="text-xs sm:text-sm font-bold tracking-[0.3em] uppercase text-white/90">
              FORMULA 1 // PIT-WALL TELEMETRY
            </div>
            <div className="text-[11px] sm:text-xs text-[#64748B] tracking-[0.2em] uppercase">
              MISSION CONTROL • REAL-TIME SENSOR CALIBRATION
            </div>
          </div>

          {/* Launch Simulator Button */}
          <div className="mt-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLaunch();
              }}
              className="px-8 py-3.5 rounded-xl bg-[#E10600] hover:bg-[#c20500] text-white font-mono text-xs font-bold tracking-widest uppercase transition-all shadow-2xl shadow-[#E10600]/40 flex items-center gap-3 transform hover:scale-105 cursor-pointer ring-1 ring-white/20"
            >
              <Zap className="w-4 h-4 fill-current" />
              LAUNCH SIMULATOR
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[10px] font-mono text-[#64748B] mt-4 tracking-wider">
            PRESS ENTER OR CLICK ANYWHERE TO LAUNCH
          </span>
        </div>
      </div>

      {/* Speed Warp Flash Overlay */}
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
