// Shared by the browser app (live updates) and scripts/fetch-data.mjs (history snapshot).
// Plain JS so Node can run it without a TypeScript step; types live in reports.d.mts.

export const API = 'https://api.smellpittsburgh.org/api/v2/smell_reports';

// The API serves every Smell MyCity region, so keep Greater Pittsburgh only
// (Allegheny + neighboring counties).
export const BBOX = { west: -80.6, south: 39.9, east: -79.4, north: 40.9 };

// Order matters: first match wins, so more specific smells come first
// ("industrial, sulfur" -> sulfur; "burning chemicals" -> smoke).
// Keep the ids in sync with SMELL_TYPES in src/smellTypes.ts.
const CATEGORIES = [
  ['sulfur', /sulf|sulph|sulfer|egg|h2s|hydrogen sul|so2/],
  ['smoke', /burn|smok|fire|soot|charcoal|\bwood\b/],
  ['sewage', /sewage|sewer|septic|garbage|trash|manure|landfill|dead|rott?ing|feces|poop|p\*\*p|fart|f\*rt|diarrh|horse|rotten/],
  ['exhaust', /exhaust|diesel|gasoline|\bgas\b|fuel|\bbus|transit|truck|vehicle/],
  ['chemical', /chemic|acrid|plastic|solvent|paint|ammonia|chlorine|toxic|asphalt|\btar\b|metal|bleach|naphth|petroleum|rubber|\boil\b|ozone|poison/],
  ['industrial', /industr|steel|mill|coke|plant|factory|pollut|coal|refiner|smelt|clairton|\bwork|indistrial|smog|mon valley/],
];

export function classify(desc) {
  const text = (desc ?? '').trim().toLowerCase();
  if (!text) return 'undescribed';
  for (const [name, re] of CATEGORIES) if (re.test(text)) return name;
  return 'other';
}

export function reportsUrl(startUnix, endUnix) {
  return `${API}?start_time=${startUnix}&end_time=${endUnix}&timezone_string=America%2FNew_York`;
}

const inBBox = (r) =>
  r.longitude > BBOX.west && r.longitude < BBOX.east &&
  r.latitude > BBOX.south && r.latitude < BBOX.north;

const clean = (s) => (s ?? '').trim() || undefined;

/** Raw API reports -> GeoJSON point features, Pittsburgh area only. */
export function toFeatures(reports) {
  return reports.filter(inBBox).map((r) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [+r.longitude.toFixed(5), +r.latitude.toFixed(5)],
    },
    properties: {
      category: classify(r.smell_description),
      value: r.smell_value,
      time: r.observed_at,
      description: clean(r.smell_description),
      symptoms: clean(r.feelings_symptoms),
      comments: clean(r.additional_comments),
    },
  }));
}

/** The API has no report id; time + rounded position is unique enough to de-duplicate. */
export function featureKey(f) {
  const [x, y] = f.geometry.coordinates;
  return `${f.properties.time}|${x}|${y}`;
}
