/**
 * Forecast engine v1 – types for input/output.
 */

export type ForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'closed';

export interface ForecastEngineInput {
  stage: string;
  amount: number | null;
  closeDate?: Date | null;
  daysSinceLastTouch: number | null;
  daysInStage: number | null;
  healthScore: number | null;
  healthStatus: 'healthy' | 'warning' | 'critical';
  healthSignals: Array<{ code: string; severity: string; penalty: number }>;
  nextFollowUpAt?: Date | null;
}

export interface ForecastDriver {
  code: string;
  label: string;
  impact: number;
}

export interface ForecastEngineOutput {
  winProbability: number;
  forecastCategory: ForecastCategory;
  expectedRevenue: number | null;
  drivers: ForecastDriver[];
}
