import { addDays, dayKey, dayStart, fmtDay, type DayKey } from './days';

// '24h' is rolling (what someone checking right now expects). '7d' is calendar-aligned:
// the 7 whole days before today plus today so far, so it matches whole cells on the calendar.
export const TIME_WINDOWS = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: 'all', label: 'Since 2025' },
] as const;

export type TimeWindowId = (typeof TIME_WINDOWS)[number]['id'];

/** Reports newer than this get the "recent" ring */
export const RECENT_SECONDS = 24 * 3600;

/** Either a rolling preset ("last 7 days") or specific calendar days picked on the calendar */
export type TimeSel =
  | { kind: 'preset'; id: TimeWindowId }
  | { kind: 'days'; from: DayKey; to: DayKey }; // inclusive

export const DEFAULT_SEL = { kind: 'preset', id: '7d' } as const satisfies TimeSel;

/** Show reports with since <= time < until (unix seconds) */
export function resolveSel(sel: TimeSel, now: number): { since: number; until: number } {
  if (sel.kind === 'days') return { since: dayStart(sel.from), until: dayStart(addDays(sel.to, 1)) };
  switch (sel.id) {
    case '24h':
      return { since: now - 24 * 3600, until: Infinity };
    case '7d':
      return { since: dayStart(addDays(dayKey(now), -7)), until: Infinity };
    case 'all':
      return { since: 0, until: Infinity };
  }
}

/** "in the last 7 days" / "on Wed, Nov 12" / "from Nov 3 to Nov 9" */
export function describeSel(sel: TimeSel): string {
  if (sel.kind === 'preset') {
    return sel.id === 'all' ? 'since Jan 2025' : `in the last ${TIME_WINDOWS.find((w) => w.id === sel.id)!.label}`;
  }
  if (sel.from === sel.to) return `on ${fmtDay(sel.from, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
  return `from ${fmtDay(sel.from)} to ${fmtDay(sel.to, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** Compact form for a collapsed section header: "7 days" / "Nov 12" / "Nov 3 – Nov 9" */
export function shortSel(sel: TimeSel): string {
  if (sel.kind === 'preset') return TIME_WINDOWS.find((w) => w.id === sel.id)!.label;
  return sel.from === sel.to ? fmtDay(sel.from) : `${fmtDay(sel.from)} – ${fmtDay(sel.to)}`;
}
