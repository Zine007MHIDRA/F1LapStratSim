import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'F1LapStratSim | Formula 1 Vehicle Dynamics & Strategy Simulator',
  description:
    'Energy-constrained quasi-static vehicle dynamics simulator with authentic FastF1 telemetry, 2025 vs 2026 technical regulations, and combinatorial pit stop optimizer.',
  keywords: ['Formula 1', 'Lap Time Simulation', 'FastF1', 'Pirelli Tyre Model', 'Race Strategy Optimizer'],
};

export const viewport: Viewport = {
  themeColor: '#080A0F',
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080A0F] text-[#F1F5F9] antialiased selection:bg-[#E10600]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
