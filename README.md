# Smell Pittsburgh Map

An interactive map of odor reports submitted by Pittsburgh residents through
[Smell Pittsburgh](https://smellpittsburgh.org), built for the **#30DayMapChallenge — Smell**.

It answers two questions: **"Does it smell bad right now, and what kind of smell?"** and
**"When and where is it usually bad?"** Reports are colored by smell type (classified from each
resident's description), sized by severity, and filterable by day, time window and smell type.
The map tops itself up with live reports from the Smell Pittsburgh API while it's open.

Built with React, TypeScript, Vite and Mapbox GL JS on the Mapbox Standard style (night preset).

## Features

- **Smell types** — each report's free-text description is classified into sulfur, industrial,
  smoke, chemical, exhaust, sewage, other or no description, and colored by type.
- **Severity** — dot size follows the 1–5 smell rating; worse smells draw on top.
- **Heatmap when zoomed out, points when zoomed in** — they crossfade between zoom 11.5 and 13.
  Heat is weighted by severity, so a "just fine" (1/5) report adds nothing.
- **Live data** — loads a saved history snapshot, then pulls anything newer from the API and
  checks again every 5 minutes. If the API is unreachable it falls back to the snapshot.
- **Recent reports** — reports from the last 24 hours get a white ring.
- **Time filters** — 24 hours (rolling), 7 days (the 7 whole days before today plus today so
  far) or everything since January 2025.
- **Day calendar** — 13 weeks of days colored by severity-weighted report volume, using the same
  color ramp as the heatmap. Click a day to see only that day; shift-click for a range (desktop).
  Page back through history to January 2025. Follows the smell-type filter.
- **Smell-type filter** — click a type to show only it, click others to add or remove them.
- **Popups** — click a dot for the type, severity, the resident's description, symptoms and time.
- **Shareable URLs** — the time selection, smell types and map position are all in the URL.
- **Mobile layout** — full-width panel pinned to the top, with collapsible sections.

## Getting started

```sh
npm install
cp .env.example .env   # then add a Mapbox public token (pk.…)
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |
| `node scripts/fetch-data.mjs [start] [end]` | Refresh the history snapshot (default start `2025-01-01`) |

The Mapbox token is read from `VITE_MAPBOX_ACCESS_TOKEN` in `.env` (git-ignored). Use a public
token restricted to the URLs the app is served from.

Refreshing the snapshot is optional: the app fetches anything newer than the snapshot from the
API at load time. Re-run it occasionally to keep that live catch-up request small.

## Shareable URL parameters

| Parameter | Example | Meaning |
| --- | --- | --- |
| `t` | `?t=24h`, `?t=all` | Time window: `24h`, `7d` (default, omitted) or `all` |
| `date` | `?date=2026-11-12` | A single day (replaces `t`) |
| `date` | `?date=2026-11-03..2026-11-09` | A range of days, inclusive |
| `types` | `?types=sulfur,industrial` | Smell types shown (default all, omitted) |
| hash | `#12/40.44/-79.93` | Map position: `zoom/lat/lng` (optionally `/bearing/pitch`) |

Days are Pittsburgh calendar days (America/New_York), including across daylight-saving changes.

## Data

Source: the Smell Pittsburgh API, `https://api.smellpittsburgh.org/api/v2/smell_reports`.
It allows browser requests (CORS `*`), so no proxy is needed.

- The API serves every Smell MyCity region, so reports are clipped to a Greater Pittsburgh
  bounding box.
- Smell types come from keyword matching on the description (first match wins, most specific
  first). The rules live in `src/lib/reports.mjs` and are shared by the app and the fetch script.
  It's a heuristic: spot-check the "Other" group before drawing conclusions.
- The API has no report id; reports are de-duplicated on time + position.
- The heatmap and calendar show where and when people **report**, not necessarily where smells
  are worst. Areas with many engaged residents report more.

## Project layout

```
scripts/fetch-data.mjs        History snapshot -> public/data/smell-reports.geojson
src/lib/reports.mjs           Shared: API URL, Pittsburgh bounding box, smell classifier
src/useSmellReports.ts        Snapshot + live API polling, de-duplication
src/smellTypes.ts             Smell types and colors, severity labels and weights, heat ramp
src/timeWindows.ts            Time presets / picked days -> time range
src/days.ts                   Pittsburgh calendar-day helpers
src/urlState.ts               Read/write ?t, ?date, ?types
src/App.tsx                   State, legend counts, per-day calendar stats
src/components/SmellMap.tsx   Map, heatmap/point/ring layers, filters, popups
src/components/Legend.tsx     Panel: summary, collapsible When / Smell type sections
src/components/DayCalendar.tsx  The 13-week day calendar
```

### Map layers (Mapbox Standard)

Layers are placed with Standard style **slots** rather than basemap layer ids:

- `smell-heat` (heatmap) in the `middle` slot — above roads, below labels. It fades out before
  3D buildings appear.
- `smell-points` and `smell-recent` (circles) in the `top` slot, so 3D buildings never hide them.

Circles use `circle-emissive-strength: 1` so the night lighting doesn't dim the data colors.

## Credits

Data: [Smell Pittsburgh](https://smellpittsburgh.org) by the CMU CREATE Lab and its community
of reporters. Basemap © Mapbox © OpenStreetMap.
