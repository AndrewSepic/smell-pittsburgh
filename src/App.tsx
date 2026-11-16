import { useCallback, useEffect, useMemo, useState } from 'react';
import SmellMap from './components/SmellMap';
import Legend from './components/Legend';
import DayCalendar, { type DayStat } from './components/DayCalendar';
import { dayKey, type DayKey } from './days';
import { SEVERITY_WEIGHT, SMELL_TYPES, type SmellTypeId } from './smellTypes';
import { DEFAULT_SEL, RECENT_SECONDS, resolveSel, type TimeSel } from './timeWindows';
import { useSmellReports } from './useSmellReports';
import { readUrlState, writeUrlState } from './urlState';

const ALL = () => new Set<SmellTypeId>(SMELL_TYPES.map((t) => t.id));
const nowS = () => Math.floor(Date.now() / 1000);
const FIRST_DAY: DayKey = '2025-01-01'; // start of the history snapshot

/** Score cut-offs for the calendar's color levels, from the spread of days actually in the data */
function levelThresholds(stats: Map<DayKey, DayStat>): number[] {
  const scores = [...stats.values()].map((s) => s.score).filter((x) => x > 0).sort((a, b) => a - b);
  if (!scores.length) return [Infinity];
  return [0.4, 0.65, 0.85, 0.95].map((q) => scores[Math.floor(q * (scores.length - 1))]);
}

export default function App() {
  const { features, checkedAt, status } = useSmellReports();
  const [initial] = useState(readUrlState);
  const [visible, setVisible] = useState<Set<SmellTypeId>>(initial.visible);
  const [sel, setSel] = useState<TimeSel>(initial.sel);

  // Keep the URL shareable: ?t=… or ?date=…, &types=…
  useEffect(() => writeUrlState(sel, visible), [sel, visible]);

  // "Now" ticks each minute so "last 24 hours" keeps sliding while the page is open
  // (or jumps forward when a live check lands)
  const [tick, setTick] = useState(nowS);
  useEffect(() => {
    const id = window.setInterval(() => setTick(nowS()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const now = Math.max(tick, checkedAt ?? 0);

  const { since, until } = resolveSel(sel, now);
  const recentSince = now - RECENT_SECONDS;
  const today = dayKey(now);

  // Legend counts for the selected time
  const counts = useMemo(() => {
    const c: Partial<Record<SmellTypeId, number>> = {};
    for (const { properties: p } of features) {
      if (p.time < since || p.time >= until) continue;
      c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [features, since, until]);

  // Per-day totals for the calendar, following the smell-type filter
  const dayStats = useMemo(() => {
    const m = new Map<DayKey, DayStat>();
    for (const { properties: p } of features) {
      if (!visible.has(p.category)) continue;
      const k = dayKey(p.time);
      const s = m.get(k) ?? { n: 0, score: 0, valueSum: 0 };
      s.n++;
      s.score += SEVERITY_WEIGHT[p.value] ?? 0;
      s.valueSum += p.value;
      m.set(k, s);
    }
    return m;
  }, [features, visible]);
  const thresholds = useMemo(() => levelThresholds(dayStats), [dayStats]);

  const picked = sel.kind === 'days' ? { from: sel.from, to: sel.to } : null;
  const covered =
    sel.kind === 'preset'
      ? { from: Number.isFinite(since) && since > 0 ? dayKey(since) : FIRST_DAY, to: today }
      : null;

  const pickDay = (day: DayKey, extend: boolean) => {
    setSel((prev) => {
      if (extend && prev.kind === 'days') {
        // Shift-click: stretch the range to include this day
        return { kind: 'days', from: day < prev.from ? day : prev.from, to: day > prev.to ? day : prev.to };
      }
      // Clicking the only selected day again returns to the default rolling window
      if (prev.kind === 'days' && prev.from === day && prev.to === day) return DEFAULT_SEL;
      return { kind: 'days', from: day, to: day };
    });
  };

  // Click to filter: from "all", a click shows only that type. Once filtered, clicks add or
  // remove types, and removing the last one returns to all (the map is never empty).
  const pickType = useCallback((id: SmellTypeId) => {
    setVisible((prev) => {
      if (prev.size === SMELL_TYPES.length) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? next : ALL();
    });
  }, []);

  return (
    <>
      <SmellMap features={features} visible={visible} since={since} until={until} recentSince={recentSince} />
      <Legend
        loading={!features.length}
        visible={visible}
        counts={counts}
        sel={sel}
        onPreset={(id) => setSel({ kind: 'preset', id })}
        calendar={
          <DayCalendar
            stats={dayStats}
            thresholds={thresholds}
            today={today}
            firstDay={FIRST_DAY}
            picked={picked}
            covered={covered}
            onPick={pickDay}
          />
        }
        status={status}
        checkedAt={checkedAt}
        onPickType={pickType}
        onAll={() => setVisible(ALL())}
      />
    </>
  );
}
