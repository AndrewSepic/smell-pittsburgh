// Fetches the Smell Pittsburgh history snapshot the app loads at startup.
// The app then pulls anything newer than this file live from the API,
// so re-running this is only needed to keep the initial download small.
//
//   node scripts/fetch-data.mjs [startDate] [endDate]
//   node scripts/fetch-data.mjs 2025-01-01
import { writeFile, mkdir } from 'node:fs/promises';
import { reportsUrl, toFeatures } from '../src/lib/reports.mjs';

const OUT = new URL('../public/data/smell-reports.geojson', import.meta.url);

const toUnix = (d) => Math.floor(new Date(d).getTime() / 1000);
const start = toUnix(process.argv[2] ?? '2025-01-01');
const end = process.argv[3] ? toUnix(process.argv[3]) : Math.floor(Date.now() / 1000);

const url = reportsUrl(start, end);
console.log(`Fetching ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
const reports = await res.json();

const features = toFeatures(reports);

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ type: 'FeatureCollection', features }));

const counts = {};
for (const f of features) counts[f.properties.category] = (counts[f.properties.category] ?? 0) + 1;
console.log(`Wrote ${features.length} of ${reports.length} reports to ${OUT.pathname}`);
console.table(counts);
