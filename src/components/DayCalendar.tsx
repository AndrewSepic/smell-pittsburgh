import { Fragment, useMemo, useState } from 'react';
import { addDays, fmtDay, weekday, type DayKey } from '../days';
import { HEAT_RAMP } from '../smellTypes';

export interface DayStat {
  n: number; // reports
  score: number; // severity-weighted reports
  valueSum: number; // for average severity
}

interface Props {
  stats: Map<DayKey, DayStat>;
  /** Score thresholds for color levels 1..4 (level 0 = some reports, below the first) */
  thresholds: number[];
  today: DayKey;
  firstDay: DayKey;
  /** Days picked on the calendar */
  picked: { from: DayKey; to: DayKey } | null;
  /** Days covered by the active preset; highlighted the same way as picked days */
  covered: { from: DayKey; to: DayKey } | null;
  onPick: (day: DayKey, extend: boolean) => void;
}

const WEEKS = 13;
const LEVEL_COLORS = HEAT_RAMP.slice(0, 5);

function level(score: number, thresholds: number[]) {
  let l = 0;
  for (const t of thresholds) if (score >= t) l++;
  return l;
}

const inRange = (k: DayKey, r: { from: DayKey; to: DayKey } | null) => !!r && k >= r.from && k <= r.to;

export default function DayCalendar({ stats, thresholds, today, firstDay, picked, covered, onPick }: Props) {
  // Last Saturday shown. Pages are aligned to the current week; a shared link to an
  // older day starts on the page that holds it.
  const [pageEnd, setPageEnd] = useState(() => {
    let end = endOfWeek(today);
    while (picked && addDays(end, -(WEEKS * 7 - 1)) > picked.to) end = addDays(end, -WEEKS * 7);
    return end;
  });
  const [hover, setHover] = useState<DayKey | null>(null);

  const weeks = useMemo(() => {
    const start = addDays(pageEnd, -(WEEKS * 7 - 1));
    return Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  }, [pageEnd]);

  const canBack = weeks[0][0] > firstDay;
  const canFwd = pageEnd < endOfWeek(today);
  const page = (dir: -1 | 1) => setPageEnd((e) => addDays(e, dir * WEEKS * 7));

  // Month label over the week column that contains the 1st of the month
  const monthLabels = weeks.map((wk) => {
    const first = wk.find((k) => k.endsWith('-01'));
    return first ? fmtDay(first, { month: 'short' }) : '';
  });

  const caption = (() => {
    const k = hover;
    if (!k) {
      // Touch screens have no shift-click, so they only get the single-day hint
      return (
        <>
          <span className="hint-pointer">{picked ? 'Click the day again to go back' : 'Click a day to see it · shift-click for a range'}</span>
          <span className="hint-touch">{picked ? 'Tap the day again to go back' : 'Tap a day to see it'}</span>
        </>
      );
    }
    const s = stats.get(k);
    const date = fmtDay(k, { weekday: 'short', month: 'short', day: 'numeric' });
    if (!s) return `${date} · no reports`;
    return `${date} · ${s.n} report${s.n === 1 ? '' : 's'} · avg ${(s.valueSum / s.n).toFixed(1)}/5`;
  })();

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => page(-1)} disabled={!canBack} aria-label="Earlier weeks">
          ‹
        </button>
        <span>
          {fmtDay(weeks[0][0], { month: 'short', year: weeks[0][0].slice(0, 4) === pageEnd.slice(0, 4) ? undefined : 'numeric' })}
          {' – '}
          {fmtDay(pageEnd, { month: 'short', year: 'numeric' })}
        </span>
        <button className="cal-nav" onClick={() => page(1)} disabled={!canFwd} aria-label="Later weeks">
          ›
        </button>
      </div>

      <div className="cal-grid" style={{ gridTemplateColumns: `14px repeat(${WEEKS}, minmax(0, 1fr))` }} onMouseLeave={() => setHover(null)}>
        <span />
        {monthLabels.map((m, i) => (
          <span key={`m${i}`} className="cal-month">
            {m}
          </span>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <Fragment key={d}>{renderRow(d)}</Fragment>
        ))}
      </div>
      <p className="cal-caption">{caption}</p>
    </div>
  );

  // A render helper, not a component: a component defined here would remount every cell on hover
  function renderRow(d: number) {
    return (
      <>
        <span className="cal-wd">{'SMTWTFS'[d]}</span>
        {weeks.map((wk) => {
          const k = wk[d];
          if (k > today || k < firstDay) return <span key={k} className="cal-cell cal-empty" />;
          const s = stats.get(k);
          // Picked days and preset-covered days share one highlight: both mean "what the map shows"
          const cls = inRange(k, picked ?? covered) ? 'cal-cell selected' : 'cal-cell';
          return (
            <button
              key={k}
              className={cls}
              style={s && s.n ? { background: LEVEL_COLORS[level(s.score, thresholds)] } : undefined}
              aria-label={`${fmtDay(k, { weekday: 'long', month: 'long', day: 'numeric' })}: ${s?.n ?? 0} reports`}
              aria-pressed={inRange(k, picked)}
              onClick={(e) => onPick(k, e.shiftKey)}
              onMouseEnter={() => setHover(k)}
              onFocus={() => setHover(k)}
            />
          );
        })}
      </>
    );
  }
}

function endOfWeek(k: DayKey): DayKey {
  return addDays(k, 6 - weekday(k));
}
