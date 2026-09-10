import React, { useEffect, useState } from 'react';
import { BarChart3, History, Loader2, Play, RotateCcw, Sparkles, Square } from 'lucide-react';
import { api } from '../../services/api';
import { BatchRunOptions, BatchRunReport, Dataset, EvalSource, Preset, Provider } from '../../types';
import { LeaderboardTable } from '../analytics/LeaderboardTable';
import { MetricsChart } from '../analytics/MetricsChart';
import { BatchRunnerModal } from './BatchRunnerModal';
import { DatasetManager } from './DatasetManager';
import { useI18n } from '../../i18n';

interface BatchEvalsViewProps {
  targetSource?: EvalSource | null;
  onClearTargetSource?: () => void;
}


const DEFAULT_SAMPLE_REPORT: BatchRunReport = {
  id: 'sample_strawberry_official',
  dataset_id: 'StrawberryEval (Official Reference)',
  status: 'completed',
  created_at: Math.floor(Date.now() / 1000) - 3600,
  total_cases: 20,
  completed_cases: 20,
  models: [
    { model_name: 'DeepSeek-R1' },
    { model_name: 'Claude-3.5-Sonnet' },
    { model_name: 'GPT-4o' },
    { model_name: 'Llama-3.1-70B' },
  ],
  model_summaries: {
    'DeepSeek-R1': {
      model_name: 'DeepSeek-R1',
      total_cases: 5,
      passed_cases: 5,
      pass_rate: 1.0,
      avg_score: 1.0,
      avg_ttft_ms: 380,
      avg_total_latency_s: 3.2,
      avg_tokens_per_second: 58.4,
      total_cost_usd: 0.0028,
      total_tokens: 1850,
    },
    'Claude-3.5-Sonnet': {
      model_name: 'Claude-3.5-Sonnet',
      total_cases: 5,
      passed_cases: 5,
      pass_rate: 1.0,
      avg_score: 1.0,
      avg_ttft_ms: 290,
      avg_total_latency_s: 2.4,
      avg_tokens_per_second: 68.2,
      total_cost_usd: 0.0084,
      total_tokens: 1420,
    },
    'GPT-4o': {
      model_name: 'GPT-4o',
      total_cases: 5,
      passed_cases: 4,
      pass_rate: 0.8,
      avg_score: 0.8,
      avg_ttft_ms: 210,
      avg_total_latency_s: 1.9,
      avg_tokens_per_second: 92.5,
      total_cost_usd: 0.0062,
      total_tokens: 1320,
    },
    'Llama-3.1-70B': {
      model_name: 'Llama-3.1-70B',
      total_cases: 5,
      passed_cases: 3,
      pass_rate: 0.6,
      avg_score: 0.6,
      avg_ttft_ms: 180,
      avg_total_latency_s: 2.1,
      avg_tokens_per_second: 76.1,
      total_cost_usd: 0.0019,
      total_tokens: 1250,
    },
  },
  case_results: [
    {
      case_id: 'case_1',
      model_name: 'DeepSeek-R1',
      prompt: "How many 'r's are there in the word 'strawberry'?",
      output_text: "Let me count carefully: s-t-r-a-w-b-e-r-r-y. The letters 'r' appear at positions 3, 8, and 9. Therefore, there are exactly 3 'r's in strawberry.",
      metrics: {
        model_name: 'DeepSeek-R1',
        ttft_ms: 380,
        total_latency_s: 2.8,
        tokens_per_second: 60.1,
        input_tokens: 22,
        output_tokens: 58,
        estimated_cost_usd: 0.0004,
      },
      eval_results: [{ evaluator_name: 'rule', passed: true, score: 1.0, reason: 'Contains expected ground truth "3"' }],
      passed: true,
    },
    {
      case_id: 'case_1',
      model_name: 'GPT-4o',
      prompt: "How many 'r's are there in the word 'strawberry'?",
      output_text: "There are 3 'r's in 'strawberry'.",
      metrics: {
        model_name: 'GPT-4o',
        ttft_ms: 210,
        total_latency_s: 1.2,
        tokens_per_second: 95.0,
        input_tokens: 22,
        output_tokens: 14,
        estimated_cost_usd: 0.0003,
      },
      eval_results: [{ evaluator_name: 'rule', passed: true, score: 1.0, reason: 'Contains expected ground truth "3"' }],
      passed: true,
    },
    {
      case_id: 'case_1',
      model_name: 'Llama-3.1-70B',
      prompt: "How many 'r's are there in the word 'strawberry'?",
      output_text: "The word 'strawberry' has 2 'r's.",
      metrics: {
        model_name: 'Llama-3.1-70B',
        ttft_ms: 180,
        total_latency_s: 1.5,
        tokens_per_second: 75.0,
        input_tokens: 22,
        output_tokens: 15,
        estimated_cost_usd: 0.0002,
      },
      eval_results: [{ evaluator_name: 'rule', passed: false, score: 0.0, reason: 'Failed: expected ground truth "3"' }],
      passed: false,
    },
  ],
};

export const BatchEvalsView: React.FC<BatchEvalsViewProps> = ({
  targetSource,
  onClearTargetSource,
}) => {
  const { t, language } = useI18n();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pastRuns, setPastRuns] = useState<BatchRunReport[]>([]);
  const [activeReport, setActiveReport] = useState<BatchRunReport | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Dataset | Preset | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<EvalSource['type']>('dataset');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'data' | 'runs'>('runs');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [runSearch, setRunSearch] = useState('');
  const [runStatus, setRunStatus] = useState('all');
  const [runSourceType, setRunSourceType] = useState('all');
  const [runModel, setRunModel] = useState('');

  const displayReport = activeReport || (showDemo ? DEFAULT_SAMPLE_REPORT : null);

  // Progress state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; current?: string }>({
    completed: 0,
    total: 0,
  });

  const loadData = async () => {
    try {
      const [dsList, presetList, provList, runsList] = await Promise.all([
        api.getDatasets(),
        api.getPresets(),
        api.getProviders(),
        api.getBatchRuns(),
      ]);
      setDatasets(dsList);
      setPresets(presetList);
      setProviders(provList);
      setPastRuns(runsList);
      if (runsList.length > 0 && !activeReport) {
        const latest = await api.getBatchReport(runsList[0].id);
        setActiveReport(latest);
        if (latest.status === 'running') watchRun(latest.id);
      }
      return { datasets: dsList, presets: presetList };
    } catch (e) {
      console.error(e);
      return { datasets: [], presets: [] };
    }
  };

  useEffect(() => {
    const init = async () => {
      const loaded = await loadData();
      if (targetSource) {
        const found = targetSource.type === 'preset'
          ? loaded.presets.find((p) => p.slug === targetSource.id)
          : loaded.datasets.find((d) => d.id === targetSource.id);
        if (found) {
          setSelectedSource(found);
          setSelectedSourceType(targetSource.type);
          setIsModalOpen(true);
        }
        onClearTargetSource?.();
      }
    };
    init();
  }, [targetSource, onClearTargetSource]);

  const watchRun = (run_id: string) => {
      setWorkspaceTab('runs');
      setIsRunning(true);
      setCurrentRunId(run_id);
      const es = new EventSource(`/api/evaluations/${run_id}/progress`);

      es.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        setProgress({
          completed: data.completed,
          total: data.total,
          current: `${data.model_name} on case ${data.case_id}`,
        });
      });

      es.addEventListener('completed', async () => {
        es.close();
        setIsRunning(false);
        setCurrentRunId(null);
        const report = await api.getBatchReport(run_id);
        setActiveReport(report);
        setShowDemo(false);
        const updatedRuns = await api.getBatchRuns();
        setPastRuns(updatedRuns);
      });

      es.addEventListener('error', (e: any) => {
        console.error('Batch progress error', e);
        es.close();
        setIsRunning(false);
        setCurrentRunId(null);
        api.getBatchReport(run_id).then(setActiveReport).catch(console.error);
      });
  };

  const handleStartBatch = async (
    source: EvalSource,
    models: any[],
    options: BatchRunOptions
  ) => {
    try {
      const { run_id } = await api.startBatchRun(source, models, options);
      setActiveReport(null);
      watchRun(run_id);
    } catch (err) {
      console.error('Failed to dispatch batch run', err);
      setIsRunning(false);
      setCurrentRunId(null);
    }
  };

  const filteredRuns = pastRuns.filter((run) => {
    const matchesSearch = (run.source_title || run.dataset_id || '').toLowerCase().includes(runSearch.toLowerCase());
    const matchesModel = run.models?.some((model) => String(model.model_name || '').toLowerCase().includes(runModel.toLowerCase()));
    return matchesSearch && (!runModel || matchesModel) && (runStatus === 'all' || run.status === runStatus) && (runSourceType === 'all' || run.source_type === runSourceType);
  });

  const retryActiveRun = async () => {
    if (!activeReport) return;
    const { run_id } = await api.retryBatchRun(activeReport.id);
    setActiveReport(null);
    watchRun(run_id);
  };

  const rerunActiveRun = async () => {
    if (!activeReport) return;
    const { run_id } = await api.rerunBatchRun(activeReport.id);
    setActiveReport(null);
    watchRun(run_id);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-end justify-between gap-4 border-b border-neutral-800">
        <div className="pb-3"><h1 className="text-xl font-bold text-neutral-50">{language === 'zh' ? '评测' : 'Evaluations'}</h1><p className="mt-1 text-sm text-neutral-400">{language === 'zh' ? '管理评测数据，并查看不可变的运行历史。' : 'Manage evaluation data and inspect immutable run history.'}</p></div>
        <div className="flex gap-1">
          {(['data', 'runs'] as const).map((tab) => <button key={tab} onClick={() => setWorkspaceTab(tab)} className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${workspaceTab === tab ? 'border-brand-400 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>{tab === 'data' ? (language === 'zh' ? '数据集' : 'Datasets') : (language === 'zh' ? '运行记录' : 'Runs')}</button>)}
        </div>
      </div>

      {workspaceTab === 'data' ? <>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-100">{language === 'zh' ? '内置评测预设' : 'Built-in evaluation presets'}</h2>
          <p className="text-xs text-neutral-500">{language === 'zh' ? '直接运行维护中的预设；仅在需要修改时创建副本。' : 'Run a maintained preset directly. Clone only when you need to customize it.'}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets.slice(0, 6).map((preset) => (
            <article key={preset.slug} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-neutral-100">{preset.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">{preset.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-purple-800 bg-purple-950 px-2 py-0.5 text-[11px] text-purple-300">{preset.case_count}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSource(preset);
                  setSelectedSourceType('preset');
                  setIsModalOpen(true);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-600/20 px-3 py-1.5 text-xs font-semibold text-brand-300 hover:bg-brand-600/30"
              >
                <Play className="h-3 w-3 fill-current" />
                {language === 'zh' ? '运行预设' : 'Run preset'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await api.clonePreset(preset.slug);
                  await loadData();
                }}
                className="ml-2 mt-3 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                {language === 'zh' ? '创建定制副本' : 'Customize copy'}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Dataset Management */}
      <DatasetManager
        datasets={datasets}
        onRefresh={loadData}
        onSelectRun={(ds) => {
          setSelectedSource(ds);
          setSelectedSourceType('dataset');
          setIsModalOpen(true);
        }}
      />

      </> : <>

      {/* Live Running Progress */}
      {isRunning && (
        <div className="bg-neutral-900 border border-brand-500/40 rounded-xl p-5 shadow-xl space-y-3 animate-pulse">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 text-brand-300">
              <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
              <span>{t.evals.runningProgress}</span>
            </div>
            <span className="font-mono text-neutral-300">
              {progress.completed} / {progress.total} (
              {progress.total ? Math.round((progress.completed / progress.total) * 100) : 0}%)
            </span>
          </div>

          <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{
                width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>

          {progress.current && (
            <div className="text-[11px] font-mono text-neutral-500 truncate">
              {t.evals.currentlyTesting} {progress.current}
            </div>
          )}
          {currentRunId && <button onClick={() => api.cancelBatchRun(currentRunId)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950"><Square className="h-3 w-3 fill-current" />{language === 'zh' ? '取消运行' : 'Cancel run'}</button>}
        </div>
      )}

      {/* Benchmark Report & Analytics */}
      {displayReport ? (
        <div className="space-y-6 pt-4 border-t border-neutral-800">
          {activeReport && <div className="grid gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 sm:grid-cols-4"><div><span className="text-[11px] uppercase text-neutral-500">Source</span><p className="mt-1 truncate text-sm font-semibold text-neutral-200">{activeReport.source_title || activeReport.dataset_id}</p></div><div><span className="text-[11px] uppercase text-neutral-500">Status</span><p className="mt-1 text-sm font-semibold capitalize text-neutral-200">{activeReport.status}</p></div><div><span className="text-[11px] uppercase text-neutral-500">Progress</span><p className="mt-1 text-sm font-semibold text-neutral-200">{activeReport.completed_cases} / {activeReport.total_cases}</p></div><div className="flex items-end justify-end"><button onClick={rerunActiveRun} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"><RotateCcw className="h-3.5 w-3.5" />Run again</button></div>{activeReport.retry_of_run_id && <p className="sm:col-span-4 text-xs text-neutral-500">Retry of <span className="font-mono text-neutral-300">{activeReport.retry_of_run_id}</span></p>}{activeReport.termination_reason && <p className="sm:col-span-4 text-xs text-rose-300">{activeReport.termination_reason}</p>}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <span>{t.evals.leaderboardTitle}</span>
                </h3>
                {activeReport ? (
                  <span className="text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                    {t.evals.liveRunBadge}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
                    {t.evals.demoNoticeBadge}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                {!activeReport
                  ? t.evals.defaultDemoDesc
                  : `${t.evals.evalResultsFor} ${activeReport.dataset_id}.`}
              </p>
            </div>

            {/* Past Runs Selector / Demo Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <input value={runSearch} onChange={(e) => setRunSearch(e.target.value)} placeholder="Search runs" className="w-36 rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-200 outline-none focus:border-brand-500" />
              <input value={runModel} onChange={(e) => setRunModel(e.target.value)} placeholder={language === 'zh' ? '筛选模型' : 'Filter model'} className="w-32 rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-200 outline-none focus:border-brand-500" />
              <select value={runStatus} onChange={(e) => setRunStatus(e.target.value)} className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"><option value="all">All statuses</option><option value="completed">Completed</option><option value="partial">Partial</option><option value="cancelled">Cancelled</option><option value="failed">Failed</option></select>
              <select value={runSourceType} onChange={(e) => setRunSourceType(e.target.value)} className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"><option value="all">All sources</option><option value="preset">Preset</option><option value="dataset">Dataset</option></select>
              {pastRuns.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <History className="w-3.5 h-3.5 text-brand-400" />
                  <span>{t.evals.runHistoryLabel}</span>
                  <select
                    value={activeReport?.id || (showDemo ? '__demo__' : '')}
                    onChange={(e) => {
                      if (e.target.value === '__demo__') {
                        setActiveReport(null);
                        setShowDemo(true);
                      } else {
                        const found = pastRuns.find((r) => r.id === e.target.value);
                        if (found) {
                          setActiveReport(null);
                          api.getBatchReport(found.id).then(setActiveReport);
                          setShowDemo(false);
                        }
                      }
                    }}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 max-w-[260px]"
                  >
                    {filteredRuns.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.dataset_id} ({new Date(r.created_at * 1000).toLocaleTimeString()}) - {r.models?.map((m) => m.model_name).join(', ')}
                      </option>
                    ))}
                    <option value="__demo__">[{t.evals.officialDemoBadge}] StrawberryEval</option>
                  </select>
                </div>
              )}

              {showDemo && (
                <button
                  onClick={() => setShowDemo(false)}
                  className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg transition-colors border border-neutral-700/60"
                >
                  {t.evals.hideDemoBtn}
                </button>
              )}
              {activeReport && activeReport.case_results?.some((item) => item.verdict === 'failed' || item.error) && <button onClick={retryActiveRun} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-950"><RotateCcw className="h-3.5 w-3.5" />{language === 'zh' ? '重试失败项' : 'Retry failed'}</button>}
            </div>
          </div>

          <MetricsChart summaries={Object.values(displayReport.model_summaries || {})} />
          <LeaderboardTable report={displayReport} />
        </div>
      ) : (
        /* Empty State when no evaluation has been run yet */
        <div className="text-center py-12 px-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mx-auto text-neutral-400">
            <BarChart3 className="w-6 h-6 text-neutral-400" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-sm font-bold text-neutral-200">{t.evals.noRunsTitle}</h4>
            <p className="text-xs text-neutral-400 leading-relaxed">{t.evals.noRunsDesc}</p>
          </div>
          <button
            onClick={() => setShowDemo(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/80 rounded-lg transition-all font-medium shadow-sm hover:shadow"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.evals.viewDemoBtn}</span>
          </button>
        </div>
      )}
      </>}

      {/* Runner Modal */}
      <BatchRunnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        source={selectedSource}
        sourceType={selectedSourceType}
        providers={providers}
        onStart={handleStartBatch}
      />
    </div>
  );
};
