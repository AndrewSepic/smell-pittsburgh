import { useEffect, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import type { SmellReportProps } from './smellTypes';
import { featureKey, reportsUrl, toFeatures, type ApiReport, type SmellFeature } from './lib/reports.mjs';

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}data/smell-reports.geojson`;
const POLL_MS = 5 * 60 * 1000;
// Re-request a little overlap: reports can land in the API a few minutes after observed_at.
const OVERLAP_S = 60 * 60;

export type LiveStatus = 'loading' | 'live' | 'offline';

export interface SmellReports {
  features: SmellFeature[];
  /** Unix seconds of the last successful live check */
  checkedAt: number | null;
  status: LiveStatus;
}

const nowS = () => Math.floor(Date.now() / 1000);

/**
 * History snapshot from /public, then live top-ups from the Smell Pittsburgh API.
 * If the API is unreachable the map still works from the snapshot.
 */
export function useSmellReports(): SmellReports {
  const [state, setState] = useState<SmellReports>({ features: [], checkedAt: null, status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const seen = new Set<string>();
    let features: SmellFeature[] = [];
    let latest = 0; // newest observed_at we hold

    const add = (incoming: SmellFeature[]) => {
      let added = 0;
      for (const f of incoming) {
        const k = featureKey(f);
        if (seen.has(k)) continue;
        seen.add(k);
        features.push(f);
        if (f.properties.time > latest) latest = f.properties.time;
        added++;
      }
      if (added) features = features.slice(); // new array so React/map see the change
      return added;
    };

    const poll = async () => {
      const end = nowS();
      try {
        const res = await fetch(reportsUrl(latest - OVERLAP_S, end));
        if (!res.ok) throw new Error(`Smell API ${res.status}`);
        add(toFeatures((await res.json()) as ApiReport[]));
        if (!cancelled) setState({ features, checkedAt: end, status: 'live' });
      } catch (err) {
        console.warn('Live smell reports unavailable, showing snapshot only', err);
        if (!cancelled) setState((s) => ({ ...s, features, status: 'offline' }));
      }
      if (!cancelled) timer = window.setTimeout(poll, POLL_MS);
    };

    (async () => {
      try {
        const res = await fetch(SNAPSHOT_URL);
        const fc = (await res.json()) as FeatureCollection<Point, SmellReportProps>;
        add(fc.features);
      } catch (err) {
        console.error('Could not load history snapshot', err);
      }
      if (!latest) latest = nowS() - 7 * 24 * 3600; // no snapshot: at least fetch the last week
      if (!cancelled) setState({ features, checkedAt: null, status: 'loading' });
      poll();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return state;
}
