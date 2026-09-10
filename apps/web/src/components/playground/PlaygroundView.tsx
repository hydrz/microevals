import React, { useEffect, useState } from 'react';
import {
  FileText,
  GitCompare,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Wrench,
} from 'lucide-react';
import { usePlaygroundStream } from '../../hooks/usePlaygroundStream';
import { api } from '../../services/api';
import { PlaygroundColumnState, Preset, Provider } from '../../types';
import { DiffViewer } from './DiffViewer';
import { ModelColumn } from './ModelColumn';
import { useI18n } from '../../i18n';
import {
  CATEGORY_DISPLAY_ORDER,
  getCategoryLabel,
  getPresetTitle,
  getPresetDescription,
  getCasePrompt,
  getCaseGroundTruth,
  getCaseSystemPrompt,
  groupPresetsByCategory,
} from '../../utils/presetHelpers';

interface PlaygroundViewProps {
  initialPreset?: Preset | null;
  onClearInitialPreset?: () => void;
}

const PLAYGROUND_STORAGE_KEY = 'microevals_playground_saved_state_v1';

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  initialPreset,
  onClearInitialPreset,
}) => {
  const { t, language } = useI18n();
  const [providers, setProviders] = useState<Provider[]>([]);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [columns, setColumns] = useState<PlaygroundColumnState[]>([]);
  const [prompt, setPrompt] = useState('How many rs are there in the word strawberry?');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [enableTools, setEnableTools] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPresetSlug, setSelectedPresetSlug] = useState<string>('');
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const { isRunning, startStream, stopStream } = usePlaygroundStream();

  useEffect(() => {
    if (initialPreset && initialPreset.cases && initialPreset.cases.length > 0) {
      if (initialPreset.category) {
        setSelectedCategory(initialPreset.category);
      }
      setSelectedPresetSlug(initialPreset.slug);
      setSelectedCaseIdx(0);
      setPrompt(getCasePrompt(initialPreset.cases[0], language));
      const sys = getCaseSystemPrompt(initialPreset.cases[0], language);
      if (sys) {
        setSystemPrompt(sys);
        setShowSystemPrompt(true);
      }
      if (initialPreset.cases[0].expected_tools && initialPreset.cases[0].expected_tools.length > 0) {
        setEnableTools(true);
      }
      onClearInitialPreset?.();
    }
  }, [initialPreset, onClearInitialPreset, language]);

  // Load initial providers & presets with state restoration
  useEffect(() => {
    const init = async () => {
      try {
        const provs = await api.getProviders();
        setProviders(provs);

        const loadedPresets = await api.getPresets();
        setPresets(loadedPresets);

        const defaultProv = provs.find((p) => p.is_default) || provs[0];
        let loadedFromStorage = false;

        try {
          const raw = localStorage.getItem(PLAYGROUND_STORAGE_KEY);
          setShowOnboarding(!raw && localStorage.getItem('microevals_onboarding_dismissed') !== '1');
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved && Array.isArray(saved.columns) && saved.columns.length > 0) {
              const restoredCols: PlaygroundColumnState[] = saved.columns.map((c: any) => {
                const provExists = provs.some((p) => p.id === c.providerId);
                const validProvId = provExists ? c.providerId : (defaultProv?.id || '');
                const targetProv = provs.find((p) => p.id === validProvId);
                const modelName = targetProv?.models.includes(c.modelName)
                  ? c.modelName
                  : (targetProv?.models[0] || c.modelName || 'default-model');

                return {
                  id: c.id || `col_${Date.now()}_${Math.random()}`,
                  providerId: validProvId,
                  modelName: modelName,
                  temperature: typeof c.temperature === 'number' ? c.temperature : 0.7,
                  maxTokens: c.maxTokens,
                  topP: typeof c.topP === 'number' ? c.topP : 1.0,
                  frequencyPenalty: typeof c.frequencyPenalty === 'number' ? c.frequencyPenalty : 0.0,
                  presencePenalty: typeof c.presencePenalty === 'number' ? c.presencePenalty : 0.0,
                  stopSequences: c.stopSequences || '',
                  seed: c.seed,
                  customSystemPrompt: c.customSystemPrompt || '',
                  output: '',
                  toolCalls: [],
                  isStreaming: false,
                };
              });

              setColumns(restoredCols);

              if (!initialPreset) {
                if (typeof saved.prompt === 'string') setPrompt(saved.prompt);
                if (typeof saved.systemPrompt === 'string') setSystemPrompt(saved.systemPrompt);
                if (typeof saved.showSystemPrompt === 'boolean') setShowSystemPrompt(saved.showSystemPrompt);
                if (typeof saved.enableTools === 'boolean') setEnableTools(saved.enableTools);
                if (typeof saved.showDiff === 'boolean') setShowDiff(saved.showDiff);
                if (saved.selectedCategory) setSelectedCategory(saved.selectedCategory);
                if (saved.selectedPresetSlug) setSelectedPresetSlug(saved.selectedPresetSlug);
                if (typeof saved.selectedCaseIdx === 'number') setSelectedCaseIdx(saved.selectedCaseIdx);
              }
              loadedFromStorage = true;
            }
          }
        } catch (e) {
          console.warn('Failed to parse saved playground state:', e);
        }

        // Fallback: 2 initial columns if no saved state found
        if (!loadedFromStorage && provs.length > 0) {
          const p1 = defaultProv || provs[0];
          const p2 = provs.find((p) => p.id !== p1.id) || p1;
          setColumns([
            {
              id: 'col_1',
              providerId: p1.id,
              modelName: p1.models[0] || 'mock-gpt-4o',
              temperature: 0.7,
              topP: 1.0,
              frequencyPenalty: 0.0,
              presencePenalty: 0.0,
              output: '',
              toolCalls: [],
              isStreaming: false,
            },
            {
              id: 'col_2',
              providerId: p2.id,
              modelName: p2.models[1] || p2.models[0] || 'mock-deepseek-r1',
              temperature: 0.7,
              topP: 1.0,
              frequencyPenalty: 0.0,
              presencePenalty: 0.0,
              output: '',
              toolCalls: [],
              isStreaming: false,
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to init playground:', err);
      } finally {
        setIsInitialized(true);
      }
    };
    init();
  }, []);

  // Persist playground state across sessions / tab switches
  useEffect(() => {
    if (!isInitialized) return;

    const stateToSave = {
      prompt,
      systemPrompt,
      showSystemPrompt,
      enableTools,
      showDiff,
      selectedCategory,
      selectedPresetSlug,
      selectedCaseIdx,
      columns: columns.map((col) => ({
        id: col.id,
        providerId: col.providerId,
        modelName: col.modelName,
        temperature: col.temperature,
        maxTokens: col.maxTokens,
        topP: col.topP,
        frequencyPenalty: col.frequencyPenalty,
        presencePenalty: col.presencePenalty,
        stopSequences: col.stopSequences,
        seed: col.seed,
        customSystemPrompt: col.customSystemPrompt,
      })),
    };

    try {
      localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save playground state:', e);
    }
  }, [
    isInitialized,
    prompt,
    systemPrompt,
    showSystemPrompt,
    enableTools,
    showDiff,
    selectedCategory,
    selectedPresetSlug,
    selectedCaseIdx,
    columns,
  ]);

  const handleResetPlayground = () => {
    if (!window.confirm(t.playground.resetConfirm)) return;
    try {
      localStorage.removeItem(PLAYGROUND_STORAGE_KEY);
    } catch {}

    const defaultProv = providers.find((p) => p.is_default) || providers[0];
    const secondProv = providers.find((p) => p.id !== defaultProv?.id) || defaultProv;

    setPrompt('How many rs are there in the word strawberry?');
    setSystemPrompt('');
    setShowSystemPrompt(false);
    setEnableTools(false);
    setShowDiff(false);
    setSelectedCategory('All');
    setSelectedPresetSlug('');
    setSelectedCaseIdx(0);

    if (defaultProv) {
      setColumns([
        {
          id: 'col_1',
          providerId: defaultProv.id,
          modelName: defaultProv.models[0] || 'mock-gpt-4o',
          temperature: 0.7,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          output: '',
          toolCalls: [],
          isStreaming: false,
        },
        {
          id: 'col_2',
          providerId: secondProv.id,
          modelName: secondProv.models[1] || secondProv.models[0] || 'mock-deepseek-r1',
          temperature: 0.7,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
          output: '',
          toolCalls: [],
          isStreaming: false,
        },
      ]);
    }
  };

  const handleAddColumn = () => {
    if (columns.length >= 4) return;
    const defaultProv = providers[0];
    setColumns((prev) => [
      ...prev,
      {
        id: `col_${Date.now()}`,
        providerId: defaultProv?.id || '',
        modelName: defaultProv?.models[0] || 'default-model',
        temperature: 0.7,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        output: '',
        toolCalls: [],
        isStreaming: false,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateColumn = (
    index: number,
    updater: (prev: PlaygroundColumnState) => PlaygroundColumnState
  ) => {
    setColumns((prev) => {
      const next = [...prev];
      next[index] = updater(next[index]);
      return next;
    });
  };

  const handleRun = () => {
    if (!prompt.trim() || isRunning) return;

    // Reset column outputs
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        output: '',
        toolCalls: [],
        metrics: undefined,
        error: undefined,
        isStreaming: true,
      }))
    );

    startStream(columns, prompt, systemPrompt || undefined, enableTools, handleUpdateColumn);
  };

  const handleRunSingle = (index: number) => {
    if (!prompt.trim() || isRunning) return;

    setColumns((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        output: '',
        toolCalls: [],
        metrics: undefined,
        error: undefined,
        isStreaming: true,
      };
      return next;
    });

    startStream(
      columns,
      prompt,
      systemPrompt || undefined,
      enableTools,
      handleUpdateColumn,
      [index]
    );
  };

  const handleClearOutputs = () => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        output: '',
        toolCalls: [],
        metrics: undefined,
        error: undefined,
      }))
    );
  };

  const currentPreset = presets.find((item) => item.slug === selectedPresetSlug);

  useEffect(() => {
    if (!currentPreset || !currentPreset.cases || !currentPreset.cases[selectedCaseIdx]) return;
    const c = currentPreset.cases[selectedCaseIdx];
    const prevZh = c.prompt_zh || '';
    const prevEn = c.prompt || '';
    if (prompt === prevZh || prompt === prevEn) {
      setPrompt(getCasePrompt(c, language));
    }
    const prevSysZh = c.system_prompt_zh || '';
    const prevSysEn = c.system_prompt || '';
    if (systemPrompt === prevSysZh || systemPrompt === prevSysEn) {
      const newSys = getCaseSystemPrompt(c, language) || '';
      setSystemPrompt(newSys);
    }
  }, [language]);

  const handleSelectPreset = (slug: string) => {
    setSelectedPresetSlug(slug);
    setSelectedCaseIdx(0);
    const p = presets.find((item) => item.slug === slug);
    if (p && p.cases && p.cases.length > 0) {
      setPrompt(getCasePrompt(p.cases[0], language));
      const sys = getCaseSystemPrompt(p.cases[0], language);
      if (sys) {
        setSystemPrompt(sys);
        setShowSystemPrompt(true);
      } else {
        setSystemPrompt('');
        setShowSystemPrompt(false);
      }
      if (p.cases[0].expected_tools && p.cases[0].expected_tools.length > 0) {
        setEnableTools(true);
      } else {
        setEnableTools(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      {showOnboarding && (
        <section className="flex flex-col gap-4 rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-950/70 to-sky-950/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-base font-bold text-white">{language === 'zh' ? '用同一个提示词并排比较模型' : 'Compare models side by side with one prompt'}</h1><p className="mt-1 text-sm text-neutral-300">{language === 'zh' ? '选择内置预设或输入自己的提示词，然后运行当前模型列。' : 'Choose a built-in preset or enter your own prompt, then run the current model columns.'}</p></div>
          <div className="flex shrink-0 gap-2"><button onClick={() => document.getElementById('playground-prompt')?.focus()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400">{language === 'zh' ? '开始评测' : 'Start evaluating'}</button><button onClick={() => { localStorage.setItem('microevals_onboarding_dismissed', '1'); setShowOnboarding(false); }} className="rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900">{language === 'zh' ? '关闭' : 'Dismiss'}</button></div>
        </section>
      )}
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Layers className="w-3.5 h-3.5 text-brand-400" />
            <span>{t.playground.categoryLabel}</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 max-w-[130px]"
            >
              <option value="All">{t.playground.categoryAll}</option>
              {CATEGORY_DISPLAY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {getCategoryLabel(cat, language)}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Preset Selector with optgroup */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{t.playground.presetLabel}</span>
            <select
              value={selectedPresetSlug}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 max-w-[210px]"
            >
              <option value="">
                {t.playground.selectPresetPlaceholder}
              </option>
              {groupPresetsByCategory(
                selectedCategory === 'All'
                  ? presets
                  : presets.filter((p) => (p.category || 'General') === selectedCategory),
                language
              ).map((group) => (
                <optgroup key={group.categoryKey} label={group.categoryLabel}>
                  {group.presets.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {getPresetTitle(p, language)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {currentPreset && currentPreset.cases && currentPreset.cases.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <span>{t.playground.caseLabel}</span>
              <select
                value={selectedCaseIdx}
                onChange={(e) => {
                  if (!currentPreset?.cases) return;
                  const idx = parseInt(e.target.value);
                  setSelectedCaseIdx(idx);
                  const c = currentPreset.cases[idx];
                  if (!c) return;
                  setPrompt(getCasePrompt(c, language));
                  const sys = getCaseSystemPrompt(c, language);
                  if (sys) {
                    setSystemPrompt(sys);
                    setShowSystemPrompt(true);
                  } else {
                    setSystemPrompt('');
                    setShowSystemPrompt(false);
                  }
                  if (c.expected_tools && c.expected_tools.length > 0) {
                    setEnableTools(true);
                  } else {
                    setEnableTools(false);
                  }
                }}
                className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 max-w-[160px]"
              >
                {currentPreset.cases.map((c, idx) => (
                  <option key={idx} value={idx}>
                    #{idx + 1}: {getCasePrompt(c, language).slice(0, 20)}...
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors ${
              showSystemPrompt || systemPrompt
                ? 'bg-neutral-800 text-neutral-100 border-neutral-700'
                : 'text-neutral-400 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.playground.systemPrompt} {systemPrompt ? '●' : ''}</span>
          </button>

          {/* Tools Toggle */}
          <button
            onClick={() => setEnableTools(!enableTools)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
              enableTools
                ? 'bg-amber-950/60 text-amber-300 border-amber-800 font-semibold shadow-sm'
                : 'text-neutral-400 border-neutral-800 hover:bg-neutral-800/50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{t.playground.toolsToggle} {enableTools ? t.playground.toolsOn : ''}</span>
          </button>

          {/* Diff Toggle (Active when at least 2 outputs exist) */}
          {columns.length >= 2 && columns[0].output && columns[1].output && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                showDiff
                  ? 'bg-brand-950/60 text-brand-300 border-brand-800 font-semibold'
                  : 'text-neutral-400 border-neutral-800 hover:bg-neutral-800/50'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{t.playground.wordDiff}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {columns.length < 4 && (
            <button
              onClick={handleAddColumn}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition-colors border border-neutral-700/60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.playground.addModel}</span>
            </button>
          )}

          <button
            onClick={handleClearOutputs}
            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            title={t.playground.clearOutputs}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetPlayground}
            className="flex items-center gap-1.5 px-2 py-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition-colors text-xs border border-transparent hover:border-neutral-800"
            title={t.playground.resetConfirm}
          >
            <span className="hidden md:inline text-[11px]">{t.playground.resetPlayground}</span>
          </button>
        </div>
      </div>

      {/* System Prompt (Collapsible) */}
      {showSystemPrompt && (
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
            {t.playground.systemPromptDesc}
          </label>
          <textarea
            rows={2}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={t.playground.systemPromptPlaceholder}
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-brand-500 font-mono"
          />
        </div>
      )}

      {/* Sandbox Demo Mode Banner */}
      {columns.some((c) => c.providerId === 'prov_mock') && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-brand-950/40 border border-brand-800/60 rounded-xl text-xs text-brand-300 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
            <span>
              <strong>{t.playground.sandboxBannerTitle}</strong> {t.playground.sandboxBannerText}
            </span>
          </div>
          <span className="text-[11px] text-brand-400/80">
            {t.playground.sandboxBannerHint}
          </span>
        </div>
      )}

      {/* Benchmark Criteria & Ground Truth Header Banner */}
      {currentPreset && currentPreset.cases && currentPreset.cases[selectedCaseIdx] && (
        <div className="bg-purple-950/30 border border-purple-800/50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 font-mono font-semibold text-[11px] border border-purple-700/50">
              {getPresetTitle(currentPreset, language)} #{selectedCaseIdx + 1}
            </span>
            <span className="text-neutral-300 font-medium">{getPresetDescription(currentPreset, language)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            {getCaseGroundTruth(currentPreset.cases[selectedCaseIdx], language) && (
              <span className="text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/60 font-semibold">
                {t.playground.targetLabel}: {getCaseGroundTruth(currentPreset.cases[selectedCaseIdx], language)}
              </span>
            )}
            {currentPreset.cases[selectedCaseIdx].expected_tools && (
              <span className="text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-800/60 font-semibold">
                {t.playground.expectedToolLabel}: {currentPreset.cases[selectedCaseIdx].expected_tools?.join(', ')}
              </span>
            )}
            <span className="text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              {t.playground.ruleLabel}: {currentPreset.cases[selectedCaseIdx].rule_type || 'contains'}
            </span>
          </div>
        </div>
      )}

      {/* Side-by-Side Model Arena Columns */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {columns.map((col, idx) => (
          <ModelColumn
            key={col.id}
            column={col}
            index={idx}
            totalColumns={columns.length}
            providers={providers}
            onUpdate={(updater) => handleUpdateColumn(idx, updater)}
            onRemove={() => handleRemoveColumn(idx)}
            onRunSingle={() => handleRunSingle(idx)}
            evaluationCriteria={
              currentPreset && currentPreset.cases && currentPreset.cases[selectedCaseIdx]
                ? {
                    groundTruth: getCaseGroundTruth(currentPreset.cases[selectedCaseIdx], language) || undefined,
                    expectedTools: currentPreset.cases[selectedCaseIdx].expected_tools || undefined,
                    ruleType: currentPreset.cases[selectedCaseIdx].rule_type || undefined,
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* Word Diff Viewer when enabled */}
      {showDiff && columns.length >= 2 && columns[0].output && columns[1].output && (
        <div className="mt-2">
          <h3 className="text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-brand-400" />
            {t.playground.diffTitle}: {columns[0].modelName} vs {columns[1].modelName}
          </h3>
          <DiffViewer
            textA={columns[0].output}
            textB={columns[1].output}
            labelA={columns[0].modelName}
            labelB={columns[1].modelName}
          />
        </div>
      )}

      {/* Bottom Sticky Prompt Input Bar */}
      <div className="sticky bottom-4 z-30 bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-xl p-3 shadow-2xl">
        <div className="flex items-end gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 px-1">
              <span>{t.playground.promptTokens} (~{Math.ceil(prompt.length / 4)} tokens)</span>
              {prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt('')}
                  className="hover:text-neutral-300 transition-colors"
                >
                  {t.playground.clearPrompt}
                </button>
              )}
            </div>
            <textarea
              id="playground-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.playground.promptPlaceholder}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-brand-500 resize-none font-sans"
            />
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {isRunning ? (
              <button
                onClick={stopStream}
                className="flex items-center justify-center gap-1.5 px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg shadow-lg transition-all"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>{t.playground.stop}</span>
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={!prompt.trim()}
                className="flex items-center justify-center gap-1.5 px-5 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-lg transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{t.playground.runAll}</span>
              </button>
            )}
            <span className="text-[10px] font-mono text-neutral-500 text-center">{t.playground.ctrlEnterHint}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
