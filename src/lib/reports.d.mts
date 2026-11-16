import type { Feature, Point } from 'geojson';
import type { SmellReportProps, SmellTypeId } from '../smellTypes';

export type SmellFeature = Feature<Point, SmellReportProps>;

/** A report as returned by api.smellpittsburgh.org/api/v2/smell_reports */
export interface ApiReport {
  latitude: number;
  longitude: number;
  smell_value: number;
  smell_description: string | null;
  feelings_symptoms: string | null;
  additional_comments: string | null;
  observed_at: number;
  zipcode?: string;
}

export const API: string;
export const BBOX: { west: number; south: number; east: number; north: number };
export function classify(desc: string | null | undefined): SmellTypeId;
export function reportsUrl(startUnix: number, endUnix: number): string;
export function toFeatures(reports: ApiReport[]): SmellFeature[];
export function featureKey(f: SmellFeature): string;
