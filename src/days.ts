// Calendar-day helpers. Days are Pittsburgh days (America/New_York), keyed 'YYYY-MM-DD'.
export const TZ = 'America/New_York';
export type DayKey = string;

const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
// New York's UTC offset only changes on whole hours, so the day of an hour is all we need to format.
const hourCache = new Map<number, DayKey>();

/** Unix seconds -> Pittsburgh calendar day */
export function dayKey(unix: number): DayKey {
  const h = Math.floor(unix / 3600);
  let k = hourCache.get(h);
  if (!k) {
    k = keyFmt.format(h * 3600 * 1000);
    hourCache.set(h, k);
  }
  return k;
}

const parts = (k: DayKey) => k.split('-').map(Number) as [number, number, number];
const utcKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Unix seconds of local midnight starting this day */
export function dayStart(k: DayKey): number {
  const [y, m, d] = parts(k);
  const est = Date.UTC(y, m - 1, d, 5) / 1000; // midnight if EST (UTC-5)
  return dayKey(est - 3600) === k ? est - 3600 : est; // EDT midnight is an hour earlier
}

export function addDays(k: DayKey, n: number): DayKey {
  const [y, m, d] = parts(k);
  return utcKey(Date.UTC(y, m - 1, d + n));
}

/** 0 = Sunday */
export function weekday(k: DayKey): number {
  const [y, m, d] = parts(k);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const isDayKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function fmtDay(k: DayKey, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  const [y, m, d] = parts(k);
  // Noon UTC keeps the formatted date stable in any viewer time zone
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
}
