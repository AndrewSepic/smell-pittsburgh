// Shareable view state in the query string:
//   ?t=24h|7d|all                 rolling time window (default 7d, omitted from the URL)
//   ?date=2026-11-12              one calendar day (replaces t)
//   ?date=2026-11-03..2026-11-09  a range of days
//   &types=sulfur,industrial      smell types shown (default all, omitted)
// Map position lives in the hash (#zoom/lat/lng), managed by mapbox-gl's `hash` option.
import { isDayKey } from './days';
import { SMELL_TYPES, type SmellTypeId } from './smellTypes';
import { DEFAULT_SEL, TIME_WINDOWS, type TimeSel, type TimeWindowId } from './timeWindows';

const TYPE_IDS = SMELL_TYPES.map((t) => t.id) as SmellTypeId[];

function readSel(q: URLSearchParams): TimeSel {
  const date = q.get('date');
  if (date) {
    const [a, b = a] = date.split('..');
    if (isDayKey(a) && isDayKey(b)) return a <= b ? { kind: 'days', from: a, to: b } : { kind: 'days', from: b, to: a };
  }
  const t = q.get('t');
  if (TIME_WINDOWS.some((w) => w.id === t)) return { kind: 'preset', id: t as TimeWindowId };
  return DEFAULT_SEL;
}

export function readUrlState(): { sel: TimeSel; visible: Set<SmellTypeId> } {
  const q = new URLSearchParams(window.location.search);

  // Ignore unknown ids; an empty/garbage list falls back to all types
  const picked = (q.get('types') ?? '')
    .split(',')
    .filter((id): id is SmellTypeId => (TYPE_IDS as string[]).includes(id));
  const visible = new Set<SmellTypeId>(picked.length ? picked : TYPE_IDS);

  return { sel: readSel(q), visible };
}

export function writeUrlState(sel: TimeSel, visible: Set<SmellTypeId>) {
  const q = new URLSearchParams(window.location.search);

  q.delete('t');
  q.delete('date');
  if (sel.kind === 'days') q.set('date', sel.from === sel.to ? sel.from : `${sel.from}..${sel.to}`);
  else if (sel.id !== DEFAULT_SEL.id) q.set('t', sel.id);

  if (visible.size === TYPE_IDS.length || visible.size === 0) q.delete('types');
  else q.set('types', TYPE_IDS.filter((id) => visible.has(id)).join(','));

  const search = q.toString().replace(/%2C/g, ',');
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  // replaceState: toggling filters shouldn't flood the back button
  window.history.replaceState(window.history.state, '', url);
}
