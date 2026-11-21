import React from 'react';

interface F1LogoProps {
  className?: string;
  variant?: 'solid' | 'trace' | 'scan' | 'punch';
  glow?: boolean;
}

export default function F1Logo({ className = 'w-96 h-24', variant = 'solid', glow = true }: F1LogoProps) {
  // Official F1 Logo Path Components
  // 1. Diagonal numeral '1'
  const path1 = "M89.9999375,30 L119.999937,0 L101.943687,0 L71.9443125,30 L89.9999375,30 Z";
  // 2. Lower crossbar curve of the 'F'
  const path2 = "M85.6986875,13.065 L49.3818125,13.065 C38.3136875,13.065 36.3768125,13.651875 31.6361875,18.3925 C27.2024375,22.82625 20.0005625,30 20.0005625,30 L35.7324375,30 L39.4855625,26.246875 C41.9530625,23.779375 43.2255625,23.52375 48.4068125,23.52375 L75.2405625,23.52375 L85.6986875,13.065 Z";
  // 3. Upper arch of the 'F'
  const path3 = "M31.1518125,16.253125 C27.8774375,19.3425 20.7530625,26.263125 16.9130625,30 L-6.25e-05,30 C-6.25e-05,30 13.5524375,16.486875 21.0849375,9.0725 C28.8455625,1.685 32.7143125,0 46.9486875,0 L98.7643125,0 L87.5449375,11.21875 L48.0011875,11.21875 C37.9993125,11.21875 35.7518125,11.911875 31.1518125,16.253125 Z";

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 120 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full overflow-visible transition-all duration-700 ${
          glow ? 'filter drop-shadow-[0_0_28px_rgba(225,6,0,0.65)]' : ''
        }`}
      >
        <defs>
          <linearGradient id="f1RedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF1801" />
            <stop offset="50%" stopColor="#E10600" />
            <stop offset="100%" stopColor="#B30500" />
          </linearGradient>

          <linearGradient id="f1ScanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E10600" stopOpacity="0.1" />
            <stop offset="45%" stopColor="#FF3333" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="55%" stopColor="#FF3333" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E10600" stopOpacity="0.1" />
          </linearGradient>

          {/* Stroke laser filter */}
          <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {variant === 'solid' && (
          <g fill="url(#f1RedGrad)">
            <path d={path1} />
            <path d={path2} />
            <path d={path3} />
          </g>
        )}

        {variant === 'trace' && (
          <g>
            {/* Background subtle ghost fill */}
            <g fill="#E10600" fillOpacity="0.08">
              <path d={path1} />
              <path d={path2} />
              <path d={path3} />
            </g>

            {/* Glowing laser stroke trace */}
            <g
              stroke="#E10600"
              strokeWidth="1.2"
              fill="url(#f1RedGrad)"
              filter="url(#laserGlow)"
              className="animate-f1-trace"
            >
              <path d={path1} />
              <path d={path2} />
              <path d={path3} />
            </g>
          </g>
        )}

        {variant === 'scan' && (
          <g>
            {/* Base dark outline */}
            <g stroke="#1A2336" strokeWidth="1" fill="#0B0F19">
              <path d={path1} />
              <path d={path2} />
              <path d={path3} />
            </g>
            {/* Dynamic scan fill */}
            <g fill="url(#f1RedGrad)" className="opacity-90">
              <path d={path1} />
              <path d={path2} />
              <path d={path3} />
            </g>
          </g>
        )}

        {variant === 'punch' && (
          <g fill="url(#f1RedGrad)" className="animate-f1-punch">
            <path d={path1} />
            <path d={path2} />
            <path d={path3} />
          </g>
        )}
      </svg>
    </div>
  );
}
