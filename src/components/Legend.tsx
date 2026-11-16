import { useState, type ReactNode } from 'react';
import { SMELL_TYPES, type SmellTypeId } from '../smellTypes';
import { TIME_WINDOWS, describeSel, shortSel, type TimeSel, type TimeWindowId } from '../timeWindows';
import type { LiveStatus } from '../useSmellReports';

interface Props {
  loading: boolean;
  visible: Set<SmellTypeId>;
  counts: Partial<Record<SmellTypeId, number>>;
  sel: TimeSel;
  onPreset: (id: TimeWindowId) => void;
  /** Day calendar, rendered under the time presets */
  calendar: ReactNode;
  status: LiveStatus;
  checkedAt: number | null;
  onPickType: (id: SmellTypeId) => void;
  onAll: () => void;
}

// Phones start with sections collapsed so the map stays visible; larger screens start open
const startOpen = () => !window.matchMedia('(max-width: 600px)').matches;

/**
 * Collapsible legend section. The header always shows the current choice (`value`), so a
 * collapsed section still says what the map is showing; `hint` replaces it while open.
 */
function Section(props: { title: string; value: string; hint?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <details className="acc" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="section">
        <span className="section-title">{props.title}</span>
        <span className="section-hint">{open && props.hint ? props.hint : props.value}</span>
        <span className="acc-chevron" aria-hidden="true" />
      </summary>
      <div className="acc-body">{props.children}</div>
    </details>
  );
}

const fmtTime = (s: number) =>
  new Date(s * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York', timeStyle: 'short' });

export default function Legend(p: Props) {
  const total = Object.values(p.counts).reduce((a, b) => a + (b ?? 0), 0);
  const presetId = p.sel.kind === 'preset' ? p.sel.id : null;
  const allTypes = p.visible.size === SMELL_TYPES.length;
  const typesValue = allTypes
    ? 'All types'
    : p.visible.size === 1
      ? SMELL_TYPES.find((t) => p.visible.has(t.id))!.label
      : `${p.visible.size} types`;
  return (
    <aside className="panel">
      <h1>Smell Pittsburgh</h1>
      <p className="lede">
        {p.loading ? '…' : total.toLocaleString()} odor reports{' '}
        {describeSel(p.sel)} from residents via{' '}
        <a href="https://smellpittsburgh.org" target="_blank" rel="noreferrer">
          Smell Pittsburgh
        </a>
        . Bigger dots are worse smells.
      </p>

      <Section title="When" value={shortSel(p.sel)}>
        <div className="segmented" role="radiogroup" aria-label="Time window">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.id}
              role="radio"
              aria-checked={presetId === w.id}
              className={presetId === w.id ? 'on' : ''}
              onClick={() => p.onPreset(w.id)}
            >
              {w.label}
            </button>
          ))}
        </div>

        {p.calendar}

        {/* One key for both the calendar cells and the zoomed-out heatmap: same weighting, same ramp */}
        <div className="heatkey">
          <span>Quieter</span>
          <span className="heatkey-ramp" aria-hidden="true" />
          <span>Worse</span>
          <span className="heatkey-note">Severity-weighted reports · calendar &amp; map heat</span>
        </div>
      </Section>

      <Section
        title="Smell type"
        value={typesValue}
        hint={
          <>
            <span className="hint-pointer">click</span>
            <span className="hint-touch">tap</span>
            {allTypes ? ' one to filter' : ' to add or remove'}
          </>
        }
      >
        <ul className="legend">
          {SMELL_TYPES.map((t) => (
            <li key={t.id} className={p.visible.has(t.id) ? '' : 'off'}>
              <button onClick={() => p.onPickType(t.id)} aria-pressed={!allTypes && p.visible.has(t.id)}>
                <span className="swatch" style={{ background: t.color }} />
                <span className="label">{t.label}</span>
                <span className="count">{(p.counts[t.id] ?? 0).toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
        {!allTypes && (
          <button className="reset" onClick={p.onAll}>
            Show all
          </button>
        )}
      </Section>

      <p className={`status status-${p.status}`}>
        <span className="status-dot" />
        {p.status === 'live' && p.checkedAt && `Live · updated ${fmtTime(p.checkedAt)}`}
        {p.status === 'loading' && 'Checking for new reports…'}
        {p.status === 'offline' && 'Live updates unavailable · showing saved history'}
      </p>
      <p className="credit">#30DayMapChallenge · Smell</p>
    </aside>
  );
}
