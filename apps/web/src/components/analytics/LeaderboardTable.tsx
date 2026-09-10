import React, { useState } from 'react';
import {
  CheckCircle2,
  CircleHelp,
  Copy,
  Download,
  FileSpreadsheet,
  Trophy,
  XCircle,
} from 'lucide-react';
import { BatchRunReport } from '../../types';
import { useI18n } from '../../i18n';

interface LeaderboardTableProps {
  report: BatchRunReport;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ report }) => {
  const { t } = useI18n();
  const [filterMode, setFilterMode] = useState<'all' | 'failed' | 'unevaluated'>('all');
  const [copiedMd, setCopiedMd] = useState(false);

  const summaries = Object.values(report.model_summaries || {}).sort(
    (a, b) => (b.pass_rate ?? -1) - (a.pass_rate ?? -1) || (b.avg_score ?? -1) - (a.avg_score ?? -1)
  );

  const filteredCases = (report.case_results || []).filter((c) => {
    if (filterMode === 'failed') return c.verdict === 'failed' || c.passed === false;
    if (filterMode === 'unevaluated') return c.verdict === 'unevaluated' || c.passed === null;
    return true;
  });

  const exportMarkdown = () => {
    let md = `# MicroEvals Benchmark Report\n\n`;
    md += `**Run ID:** \`${report.id}\` | **Total Evaluations:** ${report.completed_cases}/${report.total_cases}\n\n`;
    md += `## Leaderboard\n\n`;
    md += `| Rank | Model | Pass Rate | Score | Avg TTFT | Avg Speed | Cost (USD) |\n`;
    md += `|:----:|:------|:---------:|:-----:|:--------:|:-------:|:----------:|\n`;

    summaries.forEach((s, idx) => {
      md += `| ${idx + 1} | **${s.model_name}** | ${s.pass_rate == null ? '—' : `${s.pass_rate}%`} | ${s.avg_score == null ? '—' : `${s.avg_score}%`} | ${s.avg_ttft_ms}ms | ${s.avg_tokens_per_second} t/s | $${s.total_cost_usd} |\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const exportCSV = () => {
    let csv = `Model,PassRate,AvgScore,AvgTTFT_ms,AvgTPS,AvgLatency_s,TotalCost_USD,TotalTokens\n`;
    summaries.forEach((s) => {
      csv += `"${s.model_name}",${s.pass_rate},${s.avg_score},${s.avg_ttft_ms},${s.avg_tokens_per_second},${s.avg_total_latency_s},${s.total_cost_usd},${s.total_tokens}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `microevals_report_${report.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `microevals_report_${report.id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-bold text-neutral-100">{t.evals.leaderboardTitle}</span>
          <span className="text-xs font-mono text-neutral-500">({summaries.length} {t.evals.modelsCompared})</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700/60 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedMd ? t.evals.copiedMd : t.evals.copyMarkdown}</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700/60 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{t.evals.exportCsv}</span>
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700/60 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.evals.exportJson}</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 font-mono">
              <th className="p-3 w-12 text-center">{t.evals.rank}</th>
              <th className="p-3">{t.evals.model}</th>
              <th className="p-3 text-right">{t.evals.passRate}</th>
              <th className="p-3 text-right">{t.evals.score}</th>
              <th className="p-3 text-right">{t.evals.avgTtft}</th>
              <th className="p-3 text-right">{t.evals.avgSpeed}</th>
              <th className="p-3 text-right">{t.evals.avgLatency}</th>
              <th className="p-3 text-right">{t.evals.cost}</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-800/60 font-mono">
            {summaries.map((s, idx) => (
              <tr key={s.model_name} className="hover:bg-neutral-800/30 transition-colors">
                <td className="p-3 text-center text-neutral-500">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td className="p-3 font-semibold text-neutral-100 font-sans">{s.model_name}</td>
                <td className="p-3 text-right">
                  <span
                    className={`font-bold ${
                      s.pass_rate == null
                        ? 'text-neutral-400'
                        : s.pass_rate >= 80
                        ? 'text-emerald-400'
                        : s.pass_rate >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {s.pass_rate == null ? '—' : `${s.pass_rate}%`}
                  </span>
                  <span className="text-[10px] text-neutral-500 ml-1">
                    ({s.passed_cases}/{s.evaluated_cases ?? s.total_cases})
                  </span>
                </td>
                <td className="p-3 text-right text-neutral-300">{s.avg_score == null ? '—' : `${s.avg_score}%`}</td>
                <td className="p-3 text-right text-sky-400">{s.avg_ttft_ms}ms</td>
                <td className="p-3 text-right text-emerald-400">{s.avg_tokens_per_second} t/s</td>
                <td className="p-3 text-right text-neutral-400">{s.avg_total_latency_s}s</td>
                <td className="p-3 text-right text-amber-400">{s.total_cost_usd == null ? 'N/A' : `$${s.total_cost_usd}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Case by Case Drilldown */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-200">
            {t.evals.drilldownTitle} ({filteredCases.length} {t.evals.records})
          </h3>
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                filterMode === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.evals.allCases}
            </button>
            <button
              onClick={() => setFilterMode('failed')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                filterMode === 'failed' ? 'bg-rose-950/80 text-rose-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.evals.failedOnly}
            </button>
            <button
              onClick={() => setFilterMode('unevaluated')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                filterMode === 'unevaluated' ? 'bg-amber-950/80 text-amber-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t.evals.unevaluatedOnly}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredCases.map((c, i) => (
            <div
              key={`${c.case_id}_${c.model_name}_${i}`}
              className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 text-xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
                <div className="flex items-center gap-2">
                  {c.verdict === 'unevaluated' || c.passed === null ? (
                    <CircleHelp className="w-4 h-4 text-amber-400" />
                  ) : c.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="font-semibold text-neutral-200">{c.model_name}</span>
                  <span className="text-[10px] font-mono text-neutral-500">[{c.case_id}]</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                  <span>{Math.round(c.metrics.ttft_ms)}ms TTFT</span>
                  <span>•</span>
                  <span>{c.metrics.tokens_per_second.toFixed(1)} t/s</span>
                  <span>•</span>
                  <span>{c.metrics.estimated_cost_usd == null ? 'N/A' : `$${c.metrics.estimated_cost_usd}`}</span>
                </div>
              </div>

              {/* Prompt */}
              <div className="text-neutral-300">
                <span className="text-neutral-500 font-semibold">{t.evals.prompt} </span>
                {c.prompt}
              </div>

              {/* Output text */}
              <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800/80 font-mono text-[11px] text-neutral-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {c.output_text || (c.error ? `Error: ${c.error}` : t.evals.noOutput)}
              </div>


              {/* Evaluator reason */}
              {c.eval_results && c.eval_results.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {c.eval_results.map((er, erIdx) => (
                    <div
                      key={erIdx}
                      className={`px-2 py-1 rounded text-[10px] font-mono border flex items-center gap-1.5 ${
                        er.passed
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                          : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                      }`}
                    >
                      <span>[{er.evaluator_name}]</span>
                      <span>{er.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
