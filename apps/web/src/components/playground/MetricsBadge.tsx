import React from 'react';
import { Clock, Coins, Gauge, Zap } from 'lucide-react';
import { MetricResult } from '../../types';
import { Badge } from '../common/Badge';
import { useI18n } from '../../i18n';

interface MetricsBadgeProps {
  metrics?: MetricResult;
  elapsedMs?: number;
  ttftMs?: number;
  isStreaming?: boolean;
}

export const MetricsBadge: React.FC<MetricsBadgeProps> = ({
  metrics,
  elapsedMs,
  ttftMs,
  isStreaming,
}) => {
  const { t } = useI18n();
  const currentTtft = metrics?.ttft_ms ?? ttftMs;
  const currentElapsed = metrics?.total_latency_s
    ? (metrics.total_latency_s * 1000)
    : elapsedMs ?? 0;

  const ttftVariant =
    currentTtft !== undefined
      ? currentTtft < 400
        ? 'success'
        : currentTtft < 1000
        ? 'warning'
        : 'error'
      : 'default';

  const tps = metrics?.tokens_per_second;
  const tpsVariant =
    tps !== undefined ? (tps > 60 ? 'success' : tps > 25 ? 'info' : 'warning') : 'default';

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-2.5 bg-neutral-900/90 rounded-lg border border-neutral-800 text-[11px] font-mono">
      {/* TTFT */}
      <Badge variant={ttftVariant} className="flex items-center gap-1">
        <Zap className="w-3 h-3" />
        <span>TTFT: {currentTtft ? `${Math.round(currentTtft)}ms` : isStreaming ? t.metrics.waiting : '-'}</span>
      </Badge>

      {/* TPS */}
      <Badge variant={tpsVariant} className="flex items-center gap-1">
        <Gauge className="w-3 h-3" />
        <span>{tps ? `${tps.toFixed(1)} t/s` : isStreaming ? t.metrics.streaming : '-'}</span>
      </Badge>


      {/* Latency */}
      <Badge variant="default" className="flex items-center gap-1">
        <Clock className="w-3 h-3 text-neutral-400" />
        <span>{(currentElapsed / 1000).toFixed(2)}s</span>
      </Badge>

      {/* Tokens & Cost */}
      {metrics && (
        <>
          <Badge variant="purple">
            <span>{metrics.output_tokens} tok</span>
          </Badge>

          <Badge variant="warning" className="flex items-center gap-0.5">
            <Coins className="w-3 h-3" />
            <span>{metrics.estimated_cost_usd == null ? 'N/A' : `$${metrics.estimated_cost_usd.toFixed(5)}`}</span>
          </Badge>
        </>
      )}
    </div>
  );
};
