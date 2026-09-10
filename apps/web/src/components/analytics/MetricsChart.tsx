import React from 'react';
import { ModelBatchSummary } from '../../types';
import { useI18n } from '../../i18n';

interface MetricsChartProps {
  summaries: ModelBatchSummary[];
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ summaries }) => {
  const { t } = useI18n();
  if (!summaries || summaries.length === 0) return null;

  const maxTps = Math.max(...summaries.map((s) => s.avg_tokens_per_second), 10);
  const maxLatency = Math.max(...summaries.map((s) => s.avg_total_latency_s), 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* TPS Speed Chart */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-neutral-300 mb-3 flex items-center justify-between">
          <span>{t.evals.speedChartTitle}</span>
          <span className="text-[10px] text-neutral-500">{t.evals.higherIsBetter}</span>
        </h4>
        <div className="space-y-3">
          {summaries.map((s) => {
            const widthPct = Math.max(5, (s.avg_tokens_per_second / maxTps) * 100);
            return (
              <div key={s.model_name}>
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="text-neutral-200 truncate">{s.model_name}</span>
                  <span className="text-emerald-400 font-semibold">{s.avg_tokens_per_second} t/s</span>
                </div>
                <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Latency Chart */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-neutral-300 mb-3 flex items-center justify-between">
          <span>{t.evals.latencyChartTitle}</span>
          <span className="text-[10px] text-neutral-500">{t.evals.lowerIsBetter}</span>
        </h4>

        <div className="space-y-3">
          {summaries.map((s) => {
            const widthPct = Math.max(5, (s.avg_total_latency_s / maxLatency) * 100);
            return (
              <div key={s.model_name}>
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="text-neutral-200 truncate">{s.model_name}</span>
                  <span className="text-sky-400 font-semibold">{s.avg_total_latency_s}s</span>
                </div>
                <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
