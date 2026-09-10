import React, { useState } from 'react';
import { ChevronDown, Play, Sliders } from 'lucide-react';
import { BatchRunOptions, Dataset, EvalSource, Preset, Provider } from '../../types';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n';

interface BatchRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: Dataset | Preset | null;
  sourceType: EvalSource['type'];
  providers: Provider[];
  onStart: (source: EvalSource, models: any[], options: BatchRunOptions) => void;
}

export const BatchRunnerModal: React.FC<BatchRunnerModalProps> = ({
  isOpen,
  onClose,
  source,
  sourceType,
  providers,
  onStart,
}) => {
  const { t } = useI18n();
  const [selectedModels, setSelectedModels] = useState<
    { provider_id: string; model_name: string }[]
  >([]);
  const [concurrency, setConcurrency] = useState(3);
  const [temperature, setTemperature] = useState(0.0);
  const [topP, setTopP] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [timeout, setTimeoutVal] = useState(60);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto select first 2 models if none selected
  React.useEffect(() => {
    if (isOpen && selectedModels.length === 0 && providers.length > 0) {
      const initial: { provider_id: string; model_name: string }[] = [];
      for (const p of providers) {
        if (p.models && p.models.length > 0) {
          initial.push({ provider_id: p.id, model_name: p.models[0] });
          if (initial.length >= 2) break;
        }
      }
      setSelectedModels(initial);
    }
  }, [isOpen, providers]);

  if (!source) return null;

  const handleSelectAll = () => {
    const all: { provider_id: string; model_name: string }[] = [];
    for (const p of providers) {
      for (const m of p.models || []) {
        all.push({ provider_id: p.id, model_name: m });
      }
    }
    setSelectedModels(all);
  };

  const handleClearSelection = () => {
    setSelectedModels([]);
  };

  const handleToggleModel = (providerId: string, modelName: string) => {
    const exists = selectedModels.some(
      (m) => m.provider_id === providerId && m.model_name === modelName
    );
    if (exists) {
      setSelectedModels(
        selectedModels.filter(
          (m) => !(m.provider_id === providerId && m.model_name === modelName)
        )
      );
    } else {
      setSelectedModels([...selectedModels, { provider_id: providerId, model_name: modelName }]);
    }
  };

  const handleRun = () => {
    if (selectedModels.length === 0) return;
    onStart({ type: sourceType, id: sourceType === 'preset' ? (source as Preset).slug : source.id, title: 'name' in source ? source.name : source.title }, selectedModels, {
      concurrency,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      timeout,
      system_prompt: systemPrompt.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t.evals.modalRunTitle} ${'name' in source ? source.name : source.title}`} maxWidth="lg">
      <div className="space-y-4">
        <div>
          <div className="text-xs text-neutral-400 mb-1">{t.evals.datasetDescription}</div>
          <p className="text-xs text-neutral-200 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800">
            {source.description || t.evals.noDescription} ({source.case_count || source.cases?.length || 0} {t.evals.casesCount})
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-neutral-300">
              {t.evals.selectModelsTitle} ({selectedModels.length} {t.evals.selectedCount})
            </label>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-brand-400 hover:text-brand-300 underline"
              >
                {t.evals.selectAll}
              </button>
              <span className="text-neutral-600">|</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-neutral-400 hover:text-neutral-300 underline"
              >
                {t.evals.clear}
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
            {providers.map((prov) => (
              <div key={prov.id} className="bg-neutral-950/80 rounded-lg p-2.5 border border-neutral-800">
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  {prov.name}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(prov.models || []).map((m) => {
                    const isSelected = selectedModels.some(
                      (item) => item.provider_id === prov.id && item.model_name === m
                    );
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleToggleModel(prov.id, m)}
                        className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-brand-600/30 text-brand-300 border-brand-500 font-semibold'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Concurrency & Temperature settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <div className="flex justify-between text-xs text-neutral-400 mb-1">
              <span>{t.evals.concurrencyLimit}</span>
              <span className="font-mono text-neutral-200">{concurrency} {t.evals.concurrentRequests}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-neutral-400 mb-1">
              <span>{t.evals.temperature}</span>
              <span className="font-mono text-neutral-200">{temperature}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </div>

        {/* Collapsible Advanced Benchmark Parameters */}
        <div className="pt-2 border-t border-neutral-800/80">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
            <Sliders className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.providers.advancedSettings}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pl-3 border-l-2 border-neutral-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Top P */}
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>{t.evals.topP}</span>
                    <span className="font-mono text-neutral-200">{topP}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    {t.evals.maxTokens}
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2048"
                    value={maxTokens || ''}
                    onChange={(e) =>
                      setMaxTokens(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Timeout per case */}
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    {t.evals.timeoutLabel}
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="600"
                    value={timeout}
                    onChange={(e) => setTimeoutVal(parseInt(e.target.value) || 60)}
                    className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* System prompt override */}
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  {t.evals.systemPromptOverride}
                </label>
                <textarea
                  rows={2}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={t.evals.systemPromptOverridePlaceholder}
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-brand-500 resize-none font-sans"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 rounded-lg"
          >
            {t.evals.cancel}
          </button>
          <button
            onClick={handleRun}
            disabled={selectedModels.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{t.evals.startBenchmark}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

