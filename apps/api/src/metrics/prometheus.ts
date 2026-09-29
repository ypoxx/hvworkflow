/**
 * Prometheus text exposition (format 0.0.4) of exactly the families in `catalog.json` (slice 033b).
 * The catalog is the only list of names, types, help texts and labels; nothing here invents a family
 * or a label. Label values are meeting and unit ids from the configuration, escaped per the format.
 */
import type { Indicators } from '@hv/domain';
import catalogJson from './catalog.json' with { type: 'json' };

export interface CatalogMetric {
  name: string;
  type: 'gauge' | 'counter';
  help: string;
  labels: string[];
  purpose: string;
  source: string;
  aggregation: string;
  personalReference: string;
  spec: string;
}

export const catalog: { version: number; notice: string; definitions: string; metrics: CatalogMetric[] } =
  catalogJson as never;

export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

const escapeLabel = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
const escapeHelp = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n');

type Sample = { labels: Record<string, string>; value: number };

export function renderMetrics(indicators: Indicators, noActiveRoleTotal: number): string {
  const samples: Record<string, Sample[]> = {
    hv_open_question_oldest_age_seconds: indicators.meetings.map((m) => ({
      labels: { meeting_id: m.meetingId }, value: m.oldestOpenQuestionAgeSeconds })),
    hv_open_questions: indicators.meetings.flatMap((m) => Object.entries(m.openQuestionsByUnit).map(([unit, value]) => ({
      labels: { meeting_id: m.meetingId, unit_id: unit }, value }))),
    hv_questions_captured_last_5m: indicators.meetings.map((m) => ({
      labels: { meeting_id: m.meetingId }, value: m.questionsCapturedLast5m })),
    hv_questions_in_legal_review_over_10m: indicators.meetings.map((m) => ({
      labels: { meeting_id: m.meetingId }, value: m.questionsInLegalReviewOver10m })),
    hv_events_last_1m: [{ labels: {}, value: indicators.eventsLast1m }],
    hv_auth_no_active_role_total: [{ labels: {}, value: noActiveRoleTotal }],
  };
  const lines: string[] = [];
  for (const metric of catalog.metrics) {
    lines.push(`# HELP ${metric.name} ${escapeHelp(metric.help)}`, `# TYPE ${metric.name} ${metric.type}`);
    for (const sample of samples[metric.name] ?? []) {
      // Only labels the catalog declares, in the catalog's order.
      const labels = metric.labels.map((label) => `${label}="${escapeLabel(sample.labels[label] ?? '')}"`).join(',');
      lines.push(`${metric.name}${labels === '' ? '' : `{${labels}}`} ${sample.value}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
