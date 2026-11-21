import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BOX BOX // Formula 1 Pit-Wall Simulator',
  description:
    'Energy-constrained quasi-static vehicle dynamics simulator with authentic FastF1 telemetry, 2025 vs 2026 technical regulations, and combinatorial pit stop optimizer.',
  keywords: ['Formula 1', 'Lap Time Simulation', 'FastF1', 'Pirelli Tyre Model', 'Race Strategy Optimizer', 'BOX BOX'],
};

export const viewport: Viewport = {
  themeColor: '#050507',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#050507] text-[#F8FAFC] antialiased selection:bg-[#FF2800]/30 selection:text-white font-mono">
        {children}
      </body>
    </html>
  );
}
