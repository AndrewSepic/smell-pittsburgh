import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { ExpressionSpecification, GeoJSONFeature, GeoJSONSource } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import type { SmellFeature } from '../lib/reports.mjs';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  HEAT_RAMP,
  SEVERITY_WEIGHT,
  SMELL_TYPES,
  SMELL_VALUE_LABELS,
  type SmellReportProps,
  type SmellTypeId,
} from '../smellTypes';

const TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  import.meta.env.MAPBOX_ACCESS_TOKEN) as string;
const SOURCE = 'smell-reports';
const LAYER = 'smell-points';
const RECENT_LAYER = 'smell-recent';
const HEAT_LAYER = 'smell-heat';

// Zoomed out: heatmap. Zoomed in: type-colored points. They crossfade between these zooms.
const FADE_START = 11.5;
const FADE_END = 13;
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

const colorExpr: ExpressionSpecification = [
  'match',
  ['get', 'category'],
  ...SMELL_TYPES.flatMap((t) => [t.id, t.color]),
  '#ffffff',
] as ExpressionSpecification;

// Bigger dots for worse smells, growing with zoom.
// `zoom` must sit at the top level of an expression, so the ring radius is built
// by the same function with padding rather than wrapping this in ['+', …].
const radiusFor = (pad = 0): ExpressionSpecification => [
  'interpolate', ['linear'], ['zoom'],
  FADE_START, ['interpolate', ['linear'], ['get', 'value'], 1, 2 + pad, 5, 4.5 + pad],
  13, ['interpolate', ['linear'], ['get', 'value'], 1, 3 + pad, 5, 7 + pad],
  16, ['interpolate', ['linear'], ['get', 'value'], 1, 6 + pad, 5, 14 + pad],
];
const radiusExpr = radiusFor();

// Heat: how much each report counts. A 1/5 ("just fine") adds nothing.
const heatWeight: ExpressionSpecification = [
  'interpolate', ['linear'], ['get', 'value'],
  ...Object.entries(SEVERITY_WEIGHT).flatMap(([v, w]) => [Number(v), w]),
] as ExpressionSpecification;
// Dark-to-hot ramp, transparent at zero so the basemap shows through
const heatColor: ExpressionSpecification = [
  'interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(0,0,0,0)',
  0.1, 'rgba(76,29,110,0.55)', // HEAT_RAMP[0], partly transparent at the fringe
  0.3, HEAT_RAMP[1],
  0.5, HEAT_RAMP[2],
  0.7, HEAT_RAMP[3],
  0.9, HEAT_RAMP[4],
  1, HEAT_RAMP[5],
];

/**
 * Heat density scales with how many reports are shown: 250 reports in a week
 * would barely register at the intensity that keeps 19k reports from saturating.
 * Roughly normalise so each time window reads as a similar heat map.
 */
const heatIntensity = (n: number) => Math.min(3, Math.max(0.02, (300 / Math.max(n, 1)) ** 0.85));

function popupContent(p: SmellReportProps): HTMLElement {
  const type = SMELL_TYPES.find((t) => t.id === p.category);
  const el = document.createElement('div');
  el.className = 'popup';
  // On the container so every row (dot, quote bar) can use the category color
  if (type) el.style.setProperty('--swatch', type.color);
  const row = (cls: string, text: string) => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text; // user-written text: never innerHTML
    el.appendChild(d);
  };
  row('popup-type', type?.label ?? p.category);
  row('popup-value', `${p.value}/5 · ${SMELL_VALUE_LABELS[p.value] ?? ''}`);
  if (p.description) row('popup-quote', `“${p.description}”`);
  if (p.symptoms) row('popup-meta', `Symptoms: ${p.symptoms}`);
  if (p.comments) row('popup-meta', p.comments);
  row(
    'popup-time',
    new Date(p.time * 1000).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  );
  return el;
}

interface Props {
  features: SmellFeature[];
  visible: Set<SmellTypeId>;
  /** Show reports with since <= time < until (unix seconds) */
  since: number;
  until: number;
  /** Ring reports with time >= this */
  recentSince: number;
}

export default function SmellMap({ features, visible, since, until, recentSince }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current!,
      accessToken: TOKEN,
      style: 'mapbox://styles/mapbox/standard',
      config: {
        basemap: {
          lightPreset: 'night',
          theme: 'monochrome', // neutral basemap so the smell colors carry the map
          showPointOfInterestLabels: false,
          showTransitLabels: false,
        },
      },
      hash: true, // map position in the URL (#zoom/lat/lng) so links reopen the same view
      center: [-79.96212, 40.44523],
      zoom: 10.5,
      minZoom: 8,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('error', (e) => console.error(e.error ?? e));

    map.on('load', () => {
      map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
      // Standard style: place by slot, not by basemap layer id. Within a slot, later layers draw on top.
      // Heat sits in 'middle' (above roads, below labels); it's gone before 3D buildings appear.
      map.addLayer({
        id: HEAT_LAYER,
        type: 'heatmap',
        source: SOURCE,
        slot: 'middle',
        maxzoom: FADE_END,
        paint: {
          'heatmap-weight': heatWeight,
          'heatmap-intensity': 1, // set per time window in the filter effect
          'heatmap-color': heatColor,
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 8, 6, 11, 18, FADE_END, 40],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], FADE_START, 0.9, FADE_END, 0],
        },
      });
      map.addLayer({
        id: LAYER,
        type: 'circle',
        source: SOURCE,
        slot: 'top', // above 3D buildings, which would otherwise hide dots at high zoom
        minzoom: FADE_START, // invisible points shouldn't catch clicks
        layout: { 'circle-sort-key': ['get', 'value'] }, // worst smells drawn on top
        paint: {
          'circle-color': colorExpr,
          'circle-radius': radiusExpr,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], FADE_START, 0, FADE_END, 0.8, 15, 0.9],
          'circle-stroke-color': '#0b0b10',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], FADE_START, 0, 14, 0.75],
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], FADE_START, 0, FADE_END, 1],
          // Standard lights 3D scenes; keep data colors exact under the night preset
          'circle-emissive-strength': 1,
        },
      });
      // White ring around reports from the last 24 hours
      map.addLayer({
        id: RECENT_LAYER,
        type: 'circle',
        source: SOURCE,
        slot: 'top',
        minzoom: FADE_START,
        paint: {
          'circle-radius': radiusFor(2.5),
          'circle-opacity': 0,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], FADE_START, 0, FADE_END, 0.9],
          'circle-emissive-strength': 1,
        },
      });
      setReady(true);
    });

    const popup = new mapboxgl.Popup({ closeButton: false, maxWidth: '280px', offset: 8 });
    map.on('click', LAYER, (e) => {
      const f = e.features?.[0] as GeoJSONFeature | undefined;
      if (!f || f.geometry.type !== 'Point') return;
      popup
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(popupContent(f.properties as SmellReportProps))
        .addTo(map);
    });
    map.on('mouseenter', LAYER, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', LAYER, () => (map.getCanvas().style.cursor = ''));

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const src = mapRef.current?.getSource<GeoJSONSource>(SOURCE);
    src?.setData({ type: 'FeatureCollection', features });
  }, [ready, features]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const byType: ExpressionSpecification = ['in', ['get', 'category'], ['literal', [...visible]]];
    const inTime = (from: number): ExpressionSpecification[] => [
      ['>=', ['get', 'time'], from],
      ...(Number.isFinite(until) ? [['<', ['get', 'time'], until] as ExpressionSpecification] : []),
    ];
    const shown: ExpressionSpecification = ['all', byType, ...inTime(since)];
    map.setFilter(LAYER, shown);
    map.setFilter(HEAT_LAYER, shown);
    let n = 0;
    for (const { properties: p } of features) if (p.time >= since && p.time < until && visible.has(p.category)) n++;
    map.setPaintProperty(HEAT_LAYER, 'heatmap-intensity', heatIntensity(n));
    map.setFilter(RECENT_LAYER, ['all', byType, ...inTime(Math.max(since, recentSince))]);
  }, [ready, features, visible, since, until, recentSince]);

  return <div ref={containerRef} className="map" />;
}
