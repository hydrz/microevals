import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, Play, Sliders, Trash2, XCircle } from 'lucide-react';
import { PlaygroundColumnState, Provider } from '../../types';
import { MetricsBadge } from './MetricsBadge';
import { ToolCallTrace } from './ToolCallTrace';
import { useI18n } from '../../i18n';

interface EvaluationCriteria {
  groundTruth?: string;
  expectedTools?: string[];
  ruleType?: string;
}

interface ModelColumnProps {
  column: PlaygroundColumnState;
  index: number;
  totalColumns: number;
  providers: Provider[];
  onUpdate: (updater: (prev: PlaygroundColumnState) => PlaygroundColumnState) => void;
  onRemove: () => void;
  onRunSingle?: () => void;
  evaluationCriteria?: EvaluationCriteria;
}

export const ModelColumn: React.FC<ModelColumnProps> = ({
  column,
  totalColumns,
  providers,
  onUpdate,
  onRemove,
  onRunSingle,
  evaluationCriteria,
}) => {
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown');
  const [copied, setCopied] = useState(false);

  const currentProvider = providers.find((p) => p.id === column.providerId) || providers[0];

  const evaluationResult = React.useMemo(() => {
    if (!evaluationCriteria || !column.output || column.isStreaming) return null;
    const { groundTruth, expectedTools, ruleType } = evaluationCriteria;

    // 1. Tool checking
    if (expectedTools && expectedTools.length > 0) {
      const called = (column.toolCalls || []).map((t) => t.name);
      const passedTools = expectedTools.every((et) => called.includes(et));
      if (!passedTools) {
        return {
          passed: false,
          reason: `${t.modelColumn.missingTool}: ${expectedTools.filter((et) => !called.includes(et)).join(', ')}`,
        };
      }
    }

    // 2. Ground truth checking
    if (groundTruth) {
      if (ruleType === 'exact_match') {
        const passed = column.output.trim().toLowerCase() === groundTruth.trim().toLowerCase();
        return {
          passed,
          reason: passed ? `${t.modelColumn.exactMatch}: "${groundTruth}"` : `${t.modelColumn.expected}: "${groundTruth}"`,
        };
      } else if (ruleType === 'regex') {
        try {
          const re = new RegExp(groundTruth, 'i');
          const passed = re.test(column.output);
          return {
            passed,
            reason: passed ? `${t.modelColumn.matchedRegex}: /${groundTruth}/` : `${t.modelColumn.failedRegex}: /${groundTruth}/`,
          };
        } catch {
          // fallback
        }
      }

      // Default contains
      const passed = column.output.toLowerCase().includes(groundTruth.toLowerCase());
      return {
        passed,
        reason: passed ? `${t.modelColumn.matchesTarget}: "${groundTruth}"` : `${t.modelColumn.expected}: "${groundTruth}"`,
      };
    }

    return null;
  }, [column.output, column.isStreaming, column.toolCalls, evaluationCriteria, t]);


  const handleCopy = () => {
    navigator.clipboard.writeText(column.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex-1 min-w-[320px] bg-neutral-900/60 border border-neutral-800 rounded-xl flex flex-col overflow-hidden shadow-sm">
      {/* Column Header */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Provider Select */}
          <select
            value={column.providerId}
            onChange={(e) => {
              const newProv = providers.find((p) => p.id === e.target.value);
              onUpdate((prev) => ({
                ...prev,
                providerId: e.target.value,
                modelName: newProv?.models[0] || 'default-model',
              }));
            }}
            className="px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200 font-medium focus:outline-none focus:border-brand-500 max-w-[120px]"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Model Select */}
          <select
            value={column.modelName}
            onChange={(e) =>
              onUpdate((prev) => ({
                ...prev,
                modelName: e.target.value,
              }))
            }
            className="flex-1 min-w-0 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded text-xs font-mono font-semibold text-sky-400 focus:outline-none focus:border-brand-500 truncate"
          >
            {(currentProvider?.models || [column.modelName]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {onRunSingle && (
            <button
              onClick={onRunSingle}
              disabled={column.isStreaming}
              className="p-1.5 text-brand-400 hover:text-brand-300 hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
              title={t.modelColumn.runSingle}
            >
              <Play className="w-3.5 h-3.5 fill-brand-400" />
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors ${
              showSettings
                ? 'bg-brand-600/30 text-brand-400 border border-brand-500/40'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title={t.modelColumn.modelParams}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {totalColumns > 1 && (
            <button
              onClick={onRemove}
              className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors"
              title={t.modelColumn.removeModel}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Parameters Panel (collapsible) */}
      {showSettings && (
        <div className="p-3 bg-neutral-950/90 border-b border-neutral-800 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            {/* Temperature */}
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>{t.modelColumn.temperature}</span>
                <span className="font-mono text-neutral-200">{column.temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={column.temperature}
                onChange={(e) =>
                  onUpdate((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                }
                className="w-full accent-brand-500 h-1 bg-neutral-800 rounded"
              />
            </div>

            {/* Top P */}
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>{t.modelColumn.topP}</span>
                <span className="font-mono text-neutral-200">
                  {column.topP !== undefined ? column.topP : 1.0}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={column.topP !== undefined ? column.topP : 1.0}
                onChange={(e) =>
                  onUpdate((prev) => ({ ...prev, topP: parseFloat(e.target.value) }))
                }
                className="w-full accent-brand-500 h-1 bg-neutral-800 rounded"
              />
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>{t.modelColumn.maxTokens}</span>
                <span className="font-mono text-neutral-200">{column.maxTokens || t.modelColumn.maxTokensAuto}</span>
              </div>
              <input
                type="number"
                placeholder="e.g. 2048"
                value={column.maxTokens || ''}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    maxTokens: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                className="w-full px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Seed */}
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>{t.modelColumn.seed}</span>
                <span className="font-mono text-neutral-200">{column.seed ?? 'Random'}</span>
              </div>
              <input
                type="number"
                placeholder={t.modelColumn.seedPlaceholder}
                value={column.seed !== undefined ? column.seed : ''}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    seed: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                className="w-full px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Frequency & Presence Penalty */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-900">
            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>{t.modelColumn.frequencyPenalty}</span>
                <span className="font-mono text-neutral-200">{column.frequencyPenalty ?? 0}</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.1"
                value={column.frequencyPenalty ?? 0}
                onChange={(e) =>
                  onUpdate((prev) => ({ ...prev, frequencyPenalty: parseFloat(e.target.value) }))
                }
                className="w-full accent-brand-500 h-1 bg-neutral-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>{t.modelColumn.presencePenalty}</span>
                <span className="font-mono text-neutral-200">{column.presencePenalty ?? 0}</span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.1"
                value={column.presencePenalty ?? 0}
                onChange={(e) =>
                  onUpdate((prev) => ({ ...prev, presencePenalty: parseFloat(e.target.value) }))
                }
                className="w-full accent-brand-500 h-1 bg-neutral-800 rounded"
              />
            </div>
          </div>

          {/* Stop Sequences */}
          <div className="pt-1">
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>{t.modelColumn.stopSequences}</span>
            </div>
            <input
              type="text"
              placeholder={t.modelColumn.stopPlaceholder}
              value={column.stopSequences || ''}
              onChange={(e) =>
                onUpdate((prev) => ({
                  ...prev,
                  stopSequences: e.target.value,
                }))
              }
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Custom System Prompt Override */}
          <div className="pt-1 border-t border-neutral-900">
            <div className="flex justify-between text-neutral-400 mb-1">
              <span>{t.modelColumn.columnSystemPrompt}</span>
            </div>
            <textarea
              rows={2}
              placeholder={t.modelColumn.columnSystemPromptPlaceholder}
              value={column.customSystemPrompt || ''}
              onChange={(e) =>
                onUpdate((prev) => ({
                  ...prev,
                  customSystemPrompt: e.target.value,
                }))
              }
              className="w-full px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-brand-500 resize-none font-sans"
            />
          </div>
        </div>
      )}

      {/* Metrics Bar */}
      <div className="p-2 border-b border-neutral-800 bg-neutral-950/40">
        <MetricsBadge
          metrics={column.metrics}
          ttftMs={column.metrics?.ttft_ms}
          elapsedMs={column.metrics?.total_latency_s ? column.metrics.total_latency_s * 1000 : 0}
          isStreaming={column.isStreaming}
        />
      </div>

      {/* Content Body */}
      <div className="flex-1 p-4 overflow-y-auto min-h-[300px] max-h-[600px] flex flex-col justify-between">
        <div>
          {/* Tool Calls Trace */}
          <ToolCallTrace toolCalls={column.toolCalls} />

          {/* Error Message */}
          {column.error && (
            <div className="mb-3 p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg flex items-start gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="font-mono whitespace-pre-wrap">{column.error}</div>
            </div>
          )}

          {/* Preset Benchmark Evaluation Result */}
          {evaluationResult && (
            <div
              className={`mb-3 p-2.5 rounded-lg border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
                evaluationResult.passed
                  ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/70 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {evaluationResult.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-bold">
                  {evaluationResult.passed ? t.modelColumn.passedBenchmark : t.modelColumn.failedBenchmark}
                </span>
              </div>
              <span className="text-[11px] font-mono opacity-85 truncate max-w-[220px]">
                {evaluationResult.reason}
              </span>
            </div>
          )}

          {/* Output text */}
          {column.output ? (
            <div className="text-neutral-200 text-xs leading-relaxed font-sans whitespace-pre-wrap">
              {column.output}
              {column.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-brand-400 animate-pulse align-middle" />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-600 text-xs italic py-12">
              {column.isStreaming ? t.modelColumn.waitingToken : t.modelColumn.readyToRun}
            </div>
          )}
        </div>

        {/* Card Footer Actions */}
        {column.output && (
          <div className="mt-4 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-neutral-400 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'markdown' ? 'raw' : 'markdown')}
                className="hover:text-neutral-200 transition-colors"
              >
                {viewMode === 'markdown' ? t.modelColumn.rawText : t.modelColumn.markdown}
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-neutral-200 transition-colors p-1"
              title={t.modelColumn.copy}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.modelColumn.copied : t.modelColumn.copy}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
