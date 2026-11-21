/**
 * calendarEngine.ts
 * Real-Time Automatic Calendar & Race Weekend Detection Engine.
 * Dynamically resolves the active or upcoming Grand Prix based on the current system date,
 * session schedules, and countdowns.
 */

import { OFFICIAL_F1_SCHEDULE, GrandPrixSchedule } from '../data/f1Schedule';

export interface DynamicWeekendStatus {
  round: number;
  circuitId: string;
  gpName: string;
  circuitName: string;
  country: string;
  countryCode: string;
  isActiveWeekend: boolean;
  statusBadge: string;
  statusColor: string; // Hex color for badge styling
  countdownText: string;
  qualiTimeUtc: string;
  raceTimeUtc: string;
}

/**
 * Resolves the currently active or earliest upcoming Grand Prix round
 * based on the provided date (defaults to current system time).
 */
export function resolveLiveOrUpcomingWeekend(now: Date = new Date()): DynamicWeekendStatus {
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  const currentDay = now.getUTCDate();
  const currentYear = now.getUTCFullYear();
  const currentHour = now.getUTCHours();

  // Create comparable day of year or timestamp
  const nowMs = now.getTime();

  // 1. First check if today is inside an active race weekend window (Thursday to Monday morning)
  for (const item of OFFICIAL_F1_SCHEDULE) {
    // Construct approximate start and end dates for the current year
    // Thursday is startDay - 1
    const startWindow = new Date(Date.UTC(currentYear, item.month - 1, item.startDay - 1, 0, 0, 0)).getTime();
    // Monday morning 06:00 UTC post race
    const endWindow = new Date(Date.UTC(currentYear, item.month - 1, item.endDay + 1, 6, 0, 0)).getTime();

    if (nowMs >= startWindow && nowMs <= endWindow) {
      const dayDiff = currentDay - item.startDay;
      let statusBadge = '🔴 RACE WEEKEND LIVE';
      let statusColor = '#FF2800';

      if (dayDiff === -1) {
        statusBadge = '🟡 MEDIA DAY (THURS)';
        statusColor = '#FFB300';
      } else if (dayDiff === 0) {
        statusBadge = '🟢 PRACTICE LIVE (FP1 / FP2)';
        statusColor = '#00E676';
      } else if (dayDiff === 1) {
        statusBadge = '🟣 QUALIFYING TODAY';
        statusColor = '#B829EA';
      } else if (dayDiff === 2) {
        statusBadge = '🔴 RACE DAY TODAY';
        statusColor = '#FF2800';
      } else {
        statusBadge = '🏁 GRAND PRIX CONCLUDED';
        statusColor = '#94A3B8';
      }

      return {
        round: item.round,
        circuitId: item.circuitId,
        gpName: item.gpName,
        circuitName: item.circuitName,
        country: item.country,
        countryCode: item.countryCode,
        isActiveWeekend: true,
        statusBadge,
        statusColor,
        countdownText: 'RACE WEEKEND LIVE',
        qualiTimeUtc: item.qualiTimeUtc,
        raceTimeUtc: item.raceTimeUtc,
      };
    }
  }

  // 2. If not currently in a race weekend, find the nearest upcoming Grand Prix
  for (const item of OFFICIAL_F1_SCHEDULE) {
    const raceStart = new Date(Date.UTC(currentYear, item.month - 1, item.startDay, 10, 0, 0)).getTime();
    if (raceStart > nowMs) {
      const diffMs = raceStart - nowMs;
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

      const countdownText = days > 0 ? `IN ${days} DAYS` : `IN ${hours} HOURS`;
      const statusBadge = `⏱️ NEXT: R${String(item.round).padStart(2, '0')} (${countdownText})`;

      return {
        round: item.round,
        circuitId: item.circuitId,
        gpName: item.gpName,
        circuitName: item.circuitName,
        country: item.country,
        countryCode: item.countryCode,
        isActiveWeekend: false,
        statusBadge,
        statusColor: '#00F0FF',
        countdownText,
        qualiTimeUtc: item.qualiTimeUtc,
        raceTimeUtc: item.raceTimeUtc,
      };
    }
  }

  // 3. Past the end of current season (winter off-season): preview Round 1 (Bahrain) of next season
  const opener = OFFICIAL_F1_SCHEDULE[0];
  return {
    round: opener.round,
    circuitId: opener.circuitId,
    gpName: opener.gpName,
    circuitName: opener.circuitName,
    country: opener.country,
    countryCode: opener.countryCode,
    isActiveWeekend: false,
    statusBadge: '❄️ OFF-SEASON // SEASON OPENER PREVIEW',
    statusColor: '#94A3B8',
    countdownText: 'NEXT SEASON OPENER',
    qualiTimeUtc: opener.qualiTimeUtc,
    raceTimeUtc: opener.raceTimeUtc,
  };
}

/**
 * Returns the schedule info for a specific circuit ID
 */
export function getScheduleByCircuitId(circuitId: string): GrandPrixSchedule | undefined {
  const norm = circuitId.toLowerCase().replace(/[\s-]/g, '_');
  return OFFICIAL_F1_SCHEDULE.find((s) => s.circuitId === norm);
}
