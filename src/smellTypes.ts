// Keep the ids in sync with CATEGORIES in src/lib/reports.mjs
export const SMELL_TYPES = [
  { id: 'sulfur', label: 'Sulfur / rotten eggs', color: '#f5d33d' },
  { id: 'industrial', label: 'Industrial', color: '#ff5a4e' },
  { id: 'smoke', label: 'Smoke / burning', color: '#ff9a3c' },
  { id: 'chemical', label: 'Chemical', color: '#c77dff' },
  { id: 'exhaust', label: 'Exhaust / diesel', color: '#4cc9f0' },
  { id: 'sewage', label: 'Sewage / rot', color: '#8fd14f' },
  { id: 'other', label: 'Other', color: '#e8e2d6' },
  { id: 'undescribed', label: 'No description', color: '#7a7a85' },
] as const;

export type SmellTypeId = (typeof SMELL_TYPES)[number]['id'];

export const SMELL_VALUE_LABELS: Record<number, string> = {
  1: 'Just fine',
  2: 'Barely noticeable',
  3: 'Definitely noticeable',
  4: "It's getting pretty bad",
  5: 'About as bad as it gets',
};

export interface SmellReportProps {
  category: SmellTypeId;
  value: number;
  time: number;
  description?: string;
  symptoms?: string;
  comments?: string;
}

/** How much a report counts toward heat and "how bad was this day". A 1/5 ("just fine") adds nothing. */
export const SEVERITY_WEIGHT: Record<number, number> = { 1: 0, 2: 0.35, 3: 0.6, 4: 0.8, 5: 1 };

/** Dark-to-hot ramp shared by the heatmap, its legend key and the day calendar */
export const HEAT_RAMP = ['#4c1d6e', '#8e2a78', '#d6455a', '#f5823a', '#ffd04d', '#fff6c8'] as const;
