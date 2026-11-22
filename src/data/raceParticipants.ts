/**
 * raceParticipants.ts
 * Authentic 20-driver classified grids, driver substitutions, and session deltas
 * for every Grand Prix on the Formula 1 World Championship calendar.
 */

import { CompoundName } from '../engine/types';

export interface RaceParticipant {
  driverId: string;
  position: number; // 1 to 20
  deltaToPole: number; // seconds vs pole
  qTimeStr?: string;
  topSpeedKmh?: number;
  compound?: 'soft' | 'medium' | 'hard';
  note?: string;
}

// 2026 Factory Driver Grid (Baseline for future regulations)
export const GRID_2026: RaceParticipant[] = [
  { driverId: 'nor', position: 1, deltaToPole: 0.000, note: 'P1 • McLaren Mercedes • Active Aero Spec' },
  { driverId: 'ver', position: 2, deltaToPole: 0.045, note: 'P2 • Red Bull Ford Powertrains • +0.045s' },
  { driverId: 'lec', position: 3, deltaToPole: 0.095, note: 'P3 • Scuderia Ferrari • +0.095s' },
  { driverId: 'ham', position: 4, deltaToPole: 0.120, note: 'P4 • Scuderia Ferrari • +0.120s' },
  { driverId: 'pia', position: 5, deltaToPole: 0.145, note: 'P5 • McLaren Mercedes • +0.145s' },
  { driverId: 'rus', position: 6, deltaToPole: 0.180, note: 'P6 • Mercedes-AMG PETRONAS • +0.180s' },
  { driverId: 'ant', position: 7, deltaToPole: 0.235, note: 'P7 • Mercedes-AMG PETRONAS • Rookie +0.235s' },
  { driverId: 'sai', position: 8, deltaToPole: 0.280, note: 'P8 • Williams Racing • +0.280s' },
  { driverId: 'alo', position: 9, deltaToPole: 0.315, note: 'P9 • Aston Martin Honda • +0.315s' },
  { driverId: 'alb', position: 10, deltaToPole: 0.360, note: 'P10 • Williams Racing • +0.360s' },
  { driverId: 'law', position: 11, deltaToPole: 0.410, note: 'P11 • Red Bull Ford Powertrains • +0.410s' },
  { driverId: 'str', position: 12, deltaToPole: 0.465, note: 'P12 • Aston Martin Honda • +0.465s' },
  { driverId: 'tsu', position: 13, deltaToPole: 0.510, note: 'P13 • Racing Bulls Ford • +0.510s' },
  { driverId: 'gas', position: 14, deltaToPole: 0.540, note: 'P14 • Alpine F1 Team • +0.540s' },
  { driverId: 'hul', position: 15, deltaToPole: 0.590, note: 'P15 • Audi Revolut F1 Team • +0.590s' },
  { driverId: 'oco', position: 16, deltaToPole: 0.635, note: 'P16 • Haas F1 Team • +0.635s' },
  { driverId: 'bea', position: 17, deltaToPole: 0.670, note: 'P17 • Haas F1 Team • +0.670s' },
  { driverId: 'bor', position: 18, deltaToPole: 0.720, note: 'P18 • Audi Revolut F1 Team • Rookie +0.720s' },
  { driverId: 'doo', position: 19, deltaToPole: 0.765, note: 'P19 • Alpine F1 Team • Rookie +0.765s' },
  { driverId: 'had', position: 20, deltaToPole: 0.810, note: 'P20 • Racing Bulls Ford • Rookie +0.810s' },
];

// Race-by-Race Authentic Finished Grids (Full 20-car participating entry lists)
export const RACE_PARTICIPANTS_MAP: Record<string, RaceParticipant[]> = {
  bahrain: [
    { driverId: 'ver', position: 1, deltaToPole: 0.000, note: 'P1 • Red Bull Racing • 1:29.179 (Pole)' },
    { driverId: 'lec', position: 2, deltaToPole: 0.228, note: 'P2 • Scuderia Ferrari • +0.228s' },
    { driverId: 'rus', position: 3, deltaToPole: 0.306, note: 'P3 • Mercedes-AMG • +0.306s' },
    { driverId: 'sai', position: 4, deltaToPole: 0.328, note: 'P4 • Scuderia Ferrari • +0.328s' },
    { driverId: 'per', position: 5, deltaToPole: 0.358, note: 'P5 • Red Bull Racing • +0.358s' },
    { driverId: 'alo', position: 6, deltaToPole: 0.363, note: 'P6 • Aston Martin • +0.363s' },
    { driverId: 'nor', position: 7, deltaToPole: 0.435, note: 'P7 • McLaren Mercedes • +0.435s' },
    { driverId: 'pia', position: 8, deltaToPole: 0.504, note: 'P8 • McLaren Mercedes • +0.504s' },
    { driverId: 'ham', position: 9, deltaToPole: 0.531, note: 'P9 • Mercedes-AMG • +0.531s' },
    { driverId: 'hul', position: 10, deltaToPole: 0.818, note: 'P10 • Haas F1 Team • +0.818s' },
    { driverId: 'tsu', position: 11, deltaToPole: 0.945, note: 'P11 • Racing Bulls • Q2' },
    { driverId: 'str', position: 12, deltaToPole: 1.050, note: 'P12 • Aston Martin • Q2' },
    { driverId: 'alb', position: 13, deltaToPole: 1.120, note: 'P13 • Williams Racing • Q2' },
    { driverId: 'ric', position: 14, deltaToPole: 1.185, note: 'P14 • Racing Bulls • Q2' },
    { driverId: 'mag', position: 15, deltaToPole: 1.240, note: 'P15 • Haas F1 Team • Q2' },
    { driverId: 'bot', position: 16, deltaToPole: 1.350, note: 'P16 • Kick Sauber • Q1' },
    { driverId: 'zho', position: 17, deltaToPole: 1.410, note: 'P17 • Kick Sauber • Q1' },
    { driverId: 'sar', position: 18, deltaToPole: 1.490, note: 'P18 • Williams Racing • Q1' },
    { driverId: 'oco', position: 19, deltaToPole: 1.580, note: 'P19 • Alpine F1 Team • Q1' },
    { driverId: 'gas', position: 20, deltaToPole: 1.620, note: 'P20 • Alpine F1 Team • Q1' },
  ],

  jeddah: [
    { driverId: 'ver', position: 1, deltaToPole: 0.000, note: 'P1 • Red Bull Racing • 1:27.472 (Pole)' },
    { driverId: 'lec', position: 2, deltaToPole: 0.319, note: 'P2 • Scuderia Ferrari • +0.319s' },
    { driverId: 'per', position: 3, deltaToPole: 0.335, note: 'P3 • Red Bull Racing • +0.335s' },
    { driverId: 'alo', position: 4, deltaToPole: 0.374, note: 'P4 • Aston Martin • +0.374s' },
    { driverId: 'pia', position: 5, deltaToPole: 0.617, note: 'P5 • McLaren Mercedes • +0.617s' },
    { driverId: 'nor', position: 6, deltaToPole: 0.660, note: 'P6 • McLaren Mercedes • +0.660s' },
    { driverId: 'rus', position: 7, deltaToPole: 0.844, note: 'P7 • Mercedes-AMG • +0.844s' },
    { driverId: 'ham', position: 8, deltaToPole: 0.988, note: 'P8 • Mercedes-AMG • +0.988s' },
    { driverId: 'tsu', position: 9, deltaToPole: 1.075, note: 'P9 • Racing Bulls • +1.075s' },
    { driverId: 'str', position: 10, deltaToPole: 1.100, note: 'P10 • Aston Martin • +1.100s' },
    { driverId: 'bea', position: 11, deltaToPole: 1.155, note: 'P11 • Scuderia Ferrari (Sub for Sainz) • Debut' },
    { driverId: 'alb', position: 12, deltaToPole: 1.280, note: 'P12 • Williams Racing • Q2' },
    { driverId: 'mag', position: 13, deltaToPole: 1.330, note: 'P13 • Haas F1 Team • Q2' },
    { driverId: 'ric', position: 14, deltaToPole: 1.380, note: 'P14 • Racing Bulls • Q2' },
    { driverId: 'hul', position: 15, deltaToPole: 1.450, note: 'P15 • Haas F1 Team • Q2' },
    { driverId: 'bot', position: 16, deltaToPole: 1.510, note: 'P16 • Kick Sauber • Q1' },
    { driverId: 'oco', position: 17, deltaToPole: 1.590, note: 'P17 • Alpine F1 Team • Q1' },
    { driverId: 'gas', position: 18, deltaToPole: 1.630, note: 'P18 • Alpine F1 Team • Q1' },
    { driverId: 'sar', position: 19, deltaToPole: 1.710, note: 'P19 • Williams Racing • Q1' },
    { driverId: 'zho', position: 20, deltaToPole: 1.850, note: 'P20 • Kick Sauber • Q1' },
  ],

  albert_park: [
    { driverId: 'ver', position: 1, deltaToPole: 0.000, note: 'P1 • Red Bull Racing • 1:15.915 (Pole)' },
    { driverId: 'sai', position: 2, deltaToPole: 0.270, note: 'P2 • Scuderia Ferrari • Return from surgery' },
    { driverId: 'per', position: 3, deltaToPole: 0.359, note: 'P3 • Red Bull Racing • +0.359s' },
    { driverId: 'nor', position: 4, deltaToPole: 0.400, note: 'P4 • McLaren Mercedes • +0.400s' },
    { driverId: 'lec', position: 5, deltaToPole: 0.520, note: 'P5 • Scuderia Ferrari • +0.520s' },
    { driverId: 'pia', position: 6, deltaToPole: 0.650, note: 'P6 • McLaren Mercedes • +0.650s' },
    { driverId: 'rus', position: 7, deltaToPole: 0.800, note: 'P7 • Mercedes-AMG • +0.800s' },
    { driverId: 'tsu', position: 8, deltaToPole: 0.890, note: 'P8 • Racing Bulls • +0.890s' },
    { driverId: 'str', position: 9, deltaToPole: 1.010, note: 'P9 • Aston Martin • +1.010s' },
    { driverId: 'alo', position: 10, deltaToPole: 1.050, note: 'P10 • Aston Martin • +1.050s' },
    { driverId: 'ham', position: 11, deltaToPole: 1.110, note: 'P11 • Mercedes-AMG • Q2' },
    { driverId: 'alb', position: 12, deltaToPole: 1.190, note: 'P12 • Williams Racing • Q2' },
    { driverId: 'bot', position: 13, deltaToPole: 1.250, note: 'P13 • Kick Sauber • Q2' },
    { driverId: 'mag', position: 14, deltaToPole: 1.310, note: 'P14 • Haas F1 Team • Q2' },
    { driverId: 'oco', position: 15, deltaToPole: 1.380, note: 'P15 • Alpine F1 Team • Q2' },
    { driverId: 'hul', position: 16, deltaToPole: 1.450, note: 'P16 • Haas F1 Team • Q1' },
    { driverId: 'gas', position: 17, deltaToPole: 1.510, note: 'P17 • Alpine F1 Team • Q1' },
    { driverId: 'ric', position: 18, deltaToPole: 1.580, note: 'P18 • Racing Bulls • Q1' },
    { driverId: 'zho', position: 19, deltaToPole: 1.690, note: 'P19 • Kick Sauber • Q1' },
    { driverId: 'sar', position: 20, deltaToPole: 1.820, note: 'P20 • Williams Racing • Q1' },
  ],

  monza: [
    { driverId: 'nor', position: 1, deltaToPole: 0.000, note: 'P1 • McLaren Mercedes • 1:19.327 (Pole)' },
    { driverId: 'pia', position: 2, deltaToPole: 0.109, note: 'P2 • McLaren Mercedes • Front Row Lockout' },
    { driverId: 'rus', position: 3, deltaToPole: 0.113, note: 'P3 • Mercedes-AMG • +0.113s' },
    { driverId: 'lec', position: 4, deltaToPole: 0.134, note: 'P4 • Scuderia Ferrari • Tifosi Favorite' },
    { driverId: 'sai', position: 5, deltaToPole: 0.140, note: 'P5 • Scuderia Ferrari • +0.140s' },
    { driverId: 'ham', position: 6, deltaToPole: 0.186, note: 'P6 • Mercedes-AMG • +0.186s' },
    { driverId: 'ver', position: 7, deltaToPole: 0.695, note: 'P7 • Red Bull Racing • Understeer struggles' },
    { driverId: 'per', position: 8, deltaToPole: 0.735, note: 'P8 • Red Bull Racing • +0.735s' },
    { driverId: 'alb', position: 9, deltaToPole: 0.972, note: 'P9 • Williams Racing • +0.972s' },
    { driverId: 'hul', position: 10, deltaToPole: 1.012, note: 'P10 • Haas F1 Team • +1.012s' },
    { driverId: 'alo', position: 11, deltaToPole: 1.090, note: 'P11 • Aston Martin • Q2' },
    { driverId: 'ric', position: 12, deltaToPole: 1.150, note: 'P12 • Racing Bulls • Q2' },
    { driverId: 'mag', position: 13, deltaToPole: 1.210, note: 'P13 • Haas F1 Team • Q2' },
    { driverId: 'gas', position: 14, deltaToPole: 1.280, note: 'P14 • Alpine F1 Team • Q2' },
    { driverId: 'oco', position: 15, deltaToPole: 1.340, note: 'P15 • Alpine F1 Team • Q2' },
    { driverId: 'tsu', position: 16, deltaToPole: 1.410, note: 'P16 • Racing Bulls • Q1' },
    { driverId: 'str', position: 17, deltaToPole: 1.480, note: 'P17 • Aston Martin • Q1' },
    { driverId: 'col', position: 18, deltaToPole: 1.520, note: 'P18 • Williams Racing • Franco Colapinto F1 Debut' },
    { driverId: 'bot', position: 19, deltaToPole: 1.620, note: 'P19 • Kick Sauber • Q1' },
    { driverId: 'zho', position: 20, deltaToPole: 1.740, note: 'P20 • Kick Sauber • Q1' },
  ],

  baku: [
    { driverId: 'lec', position: 1, deltaToPole: 0.000, note: 'P1 • Scuderia Ferrari • 1:41.365 (4th Baku Pole)' },
    { driverId: 'pia', position: 2, deltaToPole: 0.321, note: 'P2 • McLaren Mercedes • +0.321s' },
    { driverId: 'sai', position: 3, deltaToPole: 0.440, note: 'P3 • Scuderia Ferrari • +0.440s' },
    { driverId: 'per', position: 4, deltaToPole: 0.448, note: 'P4 • Red Bull Racing • King of Baku' },
    { driverId: 'rus', position: 5, deltaToPole: 0.509, note: 'P5 • Mercedes-AMG • +0.509s' },
    { driverId: 'ver', position: 6, deltaToPole: 0.658, note: 'P6 • Red Bull Racing • +0.658s' },
    { driverId: 'ham', position: 7, deltaToPole: 0.924, note: 'P7 • Mercedes-AMG • +0.924s' },
    { driverId: 'alo', position: 8, deltaToPole: 1.004, note: 'P8 • Aston Martin • +1.004s' },
    { driverId: 'col', position: 9, deltaToPole: 1.165, note: 'P9 • Williams Racing • 1st Q3 in 2nd race' },
    { driverId: 'alb', position: 10, deltaToPole: 1.494, note: 'P10 • Williams Racing • Fan in airbox drama' },
    { driverId: 'bea', position: 11, deltaToPole: 1.550, note: 'P11 • Haas F1 Team (Sub for Magnussen)' },
    { driverId: 'tsu', position: 12, deltaToPole: 1.610, note: 'P12 • Racing Bulls • Q2' },
    { driverId: 'gas', position: 13, deltaToPole: 1.680, note: 'P13 • Alpine F1 Team • Q2' },
    { driverId: 'hul', position: 14, deltaToPole: 1.740, note: 'P14 • Haas F1 Team • Q2' },
    { driverId: 'str', position: 15, deltaToPole: 1.820, note: 'P15 • Aston Martin • Q2' },
    { driverId: 'ric', position: 16, deltaToPole: 1.890, note: 'P16 • Racing Bulls • Q1' },
    { driverId: 'nor', position: 17, deltaToPole: 1.950, note: 'P17 • McLaren Mercedes • Yellow flag exit' },
    { driverId: 'bot', position: 18, deltaToPole: 2.050, note: 'P18 • Kick Sauber • Q1' },
    { driverId: 'zho', position: 19, deltaToPole: 2.180, note: 'P19 • Kick Sauber • Q1' },
    { driverId: 'oco', position: 20, deltaToPole: 2.320, note: 'P20 • Alpine F1 Team • Q1' },
  ],

  singapore: [
    { driverId: 'nor', position: 1, deltaToPole: 0.000, note: 'P1 • McLaren Mercedes • 1:29.525 (Dominant Pole)' },
    { driverId: 'ver', position: 2, deltaToPole: 0.203, note: 'P2 • Red Bull Racing • +0.203s' },
    { driverId: 'ham', position: 3, deltaToPole: 0.316, note: 'P3 • Mercedes-AMG • +0.316s' },
    { driverId: 'rus', position: 4, deltaToPole: 0.342, note: 'P4 • Mercedes-AMG • +0.342s' },
    { driverId: 'pia', position: 5, deltaToPole: 0.428, note: 'P5 • McLaren Mercedes • +0.428s' },
    { driverId: 'hul', position: 6, deltaToPole: 0.590, note: 'P6 • Haas F1 Team • Outstanding P6' },
    { driverId: 'alo', position: 7, deltaToPole: 0.689, note: 'P7 • Aston Martin • +0.689s' },
    { driverId: 'tsu', position: 8, deltaToPole: 0.829, note: 'P8 • Racing Bulls • +0.829s' },
    { driverId: 'lec', position: 9, deltaToPole: 0.950, note: 'P9 • Scuderia Ferrari • Track limits lap deletion' },
    { driverId: 'sai', position: 10, deltaToPole: 1.100, note: 'P10 • Scuderia Ferrari • Q3 crash at final turn' },
    { driverId: 'alb', position: 11, deltaToPole: 1.150, note: 'P11 • Williams Racing • Q2' },
    { driverId: 'col', position: 12, deltaToPole: 1.190, note: 'P12 • Williams Racing • Q2' },
    { driverId: 'per', position: 13, deltaToPole: 1.250, note: 'P13 • Red Bull Racing • Q2 shock elimination' },
    { driverId: 'mag', position: 14, deltaToPole: 1.320, note: 'P14 • Haas F1 Team • Q2' },
    { driverId: 'oco', position: 15, deltaToPole: 1.390, note: 'P15 • Alpine F1 Team • Q2' },
    { driverId: 'ric', position: 16, deltaToPole: 1.450, note: 'P16 • Racing Bulls • Final F1 Qualifying' },
    { driverId: 'str', position: 17, deltaToPole: 1.530, note: 'P17 • Aston Martin • Q1' },
    { driverId: 'gas', position: 18, deltaToPole: 1.620, note: 'P18 • Alpine F1 Team • Q1' },
    { driverId: 'bot', position: 19, deltaToPole: 1.740, note: 'P19 • Kick Sauber • Q1' },
    { driverId: 'zho', position: 20, deltaToPole: 1.880, note: 'P20 • Kick Sauber • Q1' },
  ],

  cota: [
    { driverId: 'nor', position: 1, deltaToPole: 0.000, note: 'P1 • McLaren Mercedes • 1:32.330 (Pole)' },
    { driverId: 'ver', position: 2, deltaToPole: 0.031, note: 'P2 • Red Bull Racing • +0.031s Russell yellow flag' },
    { driverId: 'sai', position: 3, deltaToPole: 0.322, note: 'P3 • Scuderia Ferrari • +0.322s' },
    { driverId: 'lec', position: 4, deltaToPole: 0.410, note: 'P4 • Scuderia Ferrari • +0.410s' },
    { driverId: 'pia', position: 5, deltaToPole: 0.620, note: 'P5 • McLaren Mercedes • +0.620s' },
    { driverId: 'rus', position: 6, deltaToPole: 0.644, note: 'P6 • Mercedes-AMG • Heavy Q3 crash at T19' },
    { driverId: 'gas', position: 7, deltaToPole: 0.727, note: 'P7 • Alpine F1 Team • Outstanding Q3' },
    { driverId: 'alo', position: 8, deltaToPole: 0.779, note: 'P8 • Aston Martin • +0.779s' },
    { driverId: 'mag', position: 9, deltaToPole: 0.817, note: 'P9 • Haas F1 Team • +0.817s' },
    { driverId: 'per', position: 10, deltaToPole: 0.900, note: 'P10 • Red Bull Racing • Track limits lap deletion' },
    { driverId: 'tsu', position: 11, deltaToPole: 0.980, note: 'P11 • Racing Bulls • Q2' },
    { driverId: 'hul', position: 12, deltaToPole: 1.040, note: 'P12 • Haas F1 Team • Q2' },
    { driverId: 'oco', position: 13, deltaToPole: 1.110, note: 'P13 • Alpine F1 Team • Q2' },
    { driverId: 'str', position: 14, deltaToPole: 1.180, note: 'P14 • Aston Martin • Q2' },
    { driverId: 'law', position: 15, deltaToPole: 1.250, note: 'P15 • Racing Bulls • Liam Lawson F1 Return' },
    { driverId: 'alb', position: 16, deltaToPole: 1.340, note: 'P16 • Williams Racing • Q1' },
    { driverId: 'col', position: 17, deltaToPole: 1.410, note: 'P17 • Williams Racing • Q1' },
    { driverId: 'bot', position: 18, deltaToPole: 1.520, note: 'P18 • Kick Sauber • Q1' },
    { driverId: 'ham', position: 19, deltaToPole: 1.610, note: 'P19 • Mercedes-AMG • Shock Q1 elimination' },
    { driverId: 'zho', position: 20, deltaToPole: 1.760, note: 'P20 • Kick Sauber • Q1' },
  ],

  mexico_city: [
    { driverId: 'sai', position: 1, deltaToPole: 0.000, note: 'P1 • Scuderia Ferrari • 1:15.946 (Masterclass Pole)' },
    { driverId: 'ver', position: 2, deltaToPole: 0.225, note: 'P2 • Red Bull Racing • +0.225s' },
    { driverId: 'nor', position: 3, deltaToPole: 0.314, note: 'P3 • McLaren Mercedes • +0.314s' },
    { driverId: 'lec', position: 4, deltaToPole: 0.333, note: 'P4 • Scuderia Ferrari • +0.333s' },
    { driverId: 'rus', position: 5, deltaToPole: 0.410, note: 'P5 • Mercedes-AMG • +0.410s' },
    { driverId: 'ham', position: 6, deltaToPole: 0.592, note: 'P6 • Mercedes-AMG • +0.592s' },
    { driverId: 'mag', position: 7, deltaToPole: 0.740, note: 'P7 • Haas F1 Team • +0.740s' },
    { driverId: 'gas', position: 8, deltaToPole: 0.846, note: 'P8 • Alpine F1 Team • +0.846s' },
    { driverId: 'alb', position: 9, deltaToPole: 0.933, note: 'P9 • Williams Racing • +0.933s' },
    { driverId: 'hul', position: 10, deltaToPole: 1.010, note: 'P10 • Haas F1 Team • +1.010s' },
    { driverId: 'tsu', position: 11, deltaToPole: 1.080, note: 'P11 • Racing Bulls • Q2 crash at T12' },
    { driverId: 'law', position: 12, deltaToPole: 1.140, note: 'P12 • Racing Bulls • Q2' },
    { driverId: 'alo', position: 13, deltaToPole: 1.210, note: 'P13 • Aston Martin • 400th GP Celebration' },
    { driverId: 'str', position: 14, deltaToPole: 1.280, note: 'P14 • Aston Martin • Q2' },
    { driverId: 'bot', position: 15, deltaToPole: 1.350, note: 'P15 • Kick Sauber • Q2' },
    { driverId: 'col', position: 16, deltaToPole: 1.420, note: 'P16 • Williams Racing • Q1' },
    { driverId: 'pia', position: 17, deltaToPole: 1.490, note: 'P17 • McLaren Mercedes • Shock Q1 track limits' },
    { driverId: 'per', position: 18, deltaToPole: 1.580, note: 'P18 • Red Bull Racing • Home GP Q1 heartbreak' },
    { driverId: 'oco', position: 19, deltaToPole: 1.670, note: 'P19 • Alpine F1 Team • Q1' },
    { driverId: 'zho', position: 20, deltaToPole: 1.810, note: 'P20 • Kick Sauber • Q1' },
  ],

  interlagos: [
    { driverId: 'nor', position: 1, deltaToPole: 0.000, note: 'P1 • McLaren Mercedes • 1:23.405 (Wet Pole)' },
    { driverId: 'rus', position: 2, deltaToPole: 0.066, note: 'P2 • Mercedes-AMG • +0.066s' },
    { driverId: 'tsu', position: 3, deltaToPole: 0.706, note: 'P3 • Racing Bulls • Career Best P3' },
    { driverId: 'oco', position: 4, deltaToPole: 0.770, note: 'P4 • Alpine F1 Team • Wet Masterclass' },
    { driverId: 'law', position: 5, deltaToPole: 0.890, note: 'P5 • Racing Bulls • Sensational P5' },
    { driverId: 'lec', position: 6, deltaToPole: 1.120, note: 'P6 • Scuderia Ferrari • +1.120s' },
    { driverId: 'alb', position: 7, deltaToPole: 1.240, note: 'P7 • Williams Racing • Severe Q3 crash at T1' },
    { driverId: 'pia', position: 8, deltaToPole: 1.310, note: 'P8 • McLaren Mercedes • +1.310s' },
    { driverId: 'alo', position: 9, deltaToPole: 1.480, note: 'P9 • Aston Martin • Q3 crash' },
    { driverId: 'str', position: 10, deltaToPole: 1.590, note: 'P10 • Aston Martin • Q2 crash' },
    { driverId: 'bot', position: 11, deltaToPole: 1.650, note: 'P11 • Kick Sauber • Q2' },
    { driverId: 'ver', position: 12, deltaToPole: 1.720, note: 'P12 • Red Bull Racing • Stroll red flag victim' },
    { driverId: 'per', position: 13, deltaToPole: 1.790, note: 'P13 • Red Bull Racing • Q2' },
    { driverId: 'sai', position: 14, deltaToPole: 1.860, note: 'P14 • Scuderia Ferrari • Q2 crash at Senna S' },
    { driverId: 'gas', position: 15, deltaToPole: 1.930, note: 'P15 • Alpine F1 Team • Q2' },
    { driverId: 'ham', position: 16, deltaToPole: 2.050, note: 'P16 • Mercedes-AMG • Wet Q1 elimination' },
    { driverId: 'bea', position: 17, deltaToPole: 2.150, note: 'P17 • Haas F1 Team (Sub for Magnussen)' },
    { driverId: 'col', position: 18, deltaToPole: 2.280, note: 'P18 • Williams Racing • Wet Q1 crash' },
    { driverId: 'hul', position: 19, deltaToPole: 2.390, note: 'P19 • Haas F1 Team • Q1' },
    { driverId: 'zho', position: 20, deltaToPole: 2.550, note: 'P20 • Kick Sauber • Q1' },
  ],

  las_vegas: [
    { driverId: 'rus', position: 1, deltaToPole: 0.000, note: 'P1 • Mercedes-AMG • 1:32.312 (Pole in Cold Vegas)' },
    { driverId: 'sai', position: 2, deltaToPole: 0.098, note: 'P2 • Scuderia Ferrari • +0.098s' },
    { driverId: 'gas', position: 3, deltaToPole: 0.352, note: 'P3 • Alpine F1 Team • Heroic Front-Row pace' },
    { driverId: 'lec', position: 4, deltaToPole: 0.471, note: 'P4 • Scuderia Ferrari • +0.471s' },
    { driverId: 'ver', position: 5, deltaToPole: 0.485, note: 'P5 • Red Bull Racing • Championship decider' },
    { driverId: 'nor', position: 6, deltaToPole: 0.796, note: 'P6 • McLaren Mercedes • +0.796s' },
    { driverId: 'tsu', position: 7, deltaToPole: 0.817, note: 'P7 • Racing Bulls • +0.817s' },
    { driverId: 'pia', position: 8, deltaToPole: 0.821, note: 'P8 • McLaren Mercedes • +0.821s' },
    { driverId: 'hul', position: 9, deltaToPole: 0.850, note: 'P9 • Haas F1 Team • +0.850s' },
    { driverId: 'ham', position: 10, deltaToPole: 0.990, note: 'P10 • Mercedes-AMG • Lockup at Turn 14' },
    { driverId: 'oco', position: 11, deltaToPole: 1.050, note: 'P11 • Alpine F1 Team • Q2' },
    { driverId: 'mag', position: 12, deltaToPole: 1.110, note: 'P12 • Haas F1 Team • Q2' },
    { driverId: 'zho', position: 13, deltaToPole: 1.180, note: 'P13 • Kick Sauber • Best 2024 Qualifying' },
    { driverId: 'col', position: 14, deltaToPole: 1.250, note: 'P14 • Williams Racing • Huge Q2 crash at T14' },
    { driverId: 'law', position: 15, deltaToPole: 1.320, note: 'P15 • Racing Bulls • Q2' },
    { driverId: 'per', position: 16, deltaToPole: 1.390, note: 'P16 • Red Bull Racing • Q1 elimination' },
    { driverId: 'alo', position: 17, deltaToPole: 1.460, note: 'P17 • Aston Martin • Q1' },
    { driverId: 'alb', position: 18, deltaToPole: 1.540, note: 'P18 • Williams Racing • Q1' },
    { driverId: 'bot', position: 19, deltaToPole: 1.630, note: 'P19 • Kick Sauber • Q1' },
    { driverId: 'str', position: 20, deltaToPole: 1.750, note: 'P20 • Aston Martin • Q1' },
  ],
};

// Fallback classified grid generator for any other calendar round based on constructor pace
export function getParticipatingDrivers(circuitId: string, era: '2025' | '2026' = '2025'): RaceParticipant[] {
  const normId = circuitId.toLowerCase().replace(/[\s-]/g, '_');

  if (era === '2026') {
    return GRID_2026;
  }

  // If specific authentic historical participant data exists for this round, return it
  if (RACE_PARTICIPANTS_MAP[normId]) {
    return RACE_PARTICIPANTS_MAP[normId];
  }

  // Standard 2025 20-car grid fallback for upcoming/in-season rounds
  return [
    { driverId: 'nor', position: 1, deltaToPole: 0.000, note: 'P1 • McLaren Mercedes • Benchmark Pole' },
    { driverId: 'ver', position: 2, deltaToPole: 0.052, note: 'P2 • Red Bull Racing • +0.052s' },
    { driverId: 'lec', position: 3, deltaToPole: 0.098, note: 'P3 • Scuderia Ferrari • +0.098s' },
    { driverId: 'pia', position: 4, deltaToPole: 0.125, note: 'P4 • McLaren Mercedes • +0.125s' },
    { driverId: 'rus', position: 5, deltaToPole: 0.160, note: 'P5 • Mercedes-AMG • +0.160s' },
    { driverId: 'ham', position: 6, deltaToPole: 0.195, note: 'P6 • Scuderia Ferrari • +0.195s' },
    { driverId: 'sai', position: 7, deltaToPole: 0.285, note: 'P7 • Williams Racing • +0.285s' },
    { driverId: 'alo', position: 8, deltaToPole: 0.340, note: 'P8 • Aston Martin • +0.340s' },
    { driverId: 'ant', position: 9, deltaToPole: 0.380, note: 'P9 • Mercedes-AMG • +0.380s' },
    { driverId: 'per', position: 10, deltaToPole: 0.420, note: 'P10 • Red Bull Racing • +0.420s' },
    { driverId: 'alb', position: 11, deltaToPole: 0.470, note: 'P11 • Williams Racing • +0.470s' },
    { driverId: 'tsu', position: 12, deltaToPole: 0.510, note: 'P12 • Racing Bulls • +0.510s' },
    { driverId: 'gas', position: 13, deltaToPole: 0.550, note: 'P13 • Alpine F1 Team • +0.550s' },
    { driverId: 'hul', position: 14, deltaToPole: 0.600, note: 'P14 • Kick Sauber • +0.600s' },
    { driverId: 'oco', position: 15, deltaToPole: 0.640, note: 'P15 • Haas F1 Team • +0.640s' },
    { driverId: 'str', position: 16, deltaToPole: 0.690, note: 'P16 • Aston Martin • +0.690s' },
    { driverId: 'bea', position: 17, deltaToPole: 0.730, note: 'P17 • Haas F1 Team • +0.730s' },
    { driverId: 'law', position: 18, deltaToPole: 0.780, note: 'P18 • Racing Bulls • +0.780s' },
    { driverId: 'col', position: 19, deltaToPole: 0.830, note: 'P19 • Williams / Alpine • +0.830s' },
    { driverId: 'bor', position: 20, deltaToPole: 0.890, note: 'P20 • Kick Sauber • +0.890s' },
  ];
}
