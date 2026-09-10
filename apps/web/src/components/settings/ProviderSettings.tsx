import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Sliders,
  Star,
  Trash2,
  Wifi,
  XCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { Provider } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n';

interface ProviderTemplate {
  name: string;
  label: string;
  base_url: string;
  models: string[];
  custom_headers?: Record<string, string>;
  timeout_seconds?: number;
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    name: 'DeepSeek',
    label: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    timeout_seconds: 180,
  },
  {
    name: 'SiliconFlow',
    label: 'SiliconFlow (硅基流动)',
    base_url: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Pro/deepseek-ai/DeepSeek-V3'],
    timeout_seconds: 120,
  },
  {
    name: 'OpenRouter',
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-r1', 'google/gemini-2.0-flash-001'],
    custom_headers: { 'HTTP-Referer': 'https://microevals.ai', 'X-Title': 'MicroEvals' },
    timeout_seconds: 120,
  },
  {
    name: 'OpenAI',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
    timeout_seconds: 90,
  },
  {
    name: 'Ollama Local',
    label: 'Ollama (Local)',
    base_url: 'http://localhost:11434/v1',
    models: ['llama3.1', 'deepseek-r1:8b', 'qwen2.5-coder', 'mistral'],
    timeout_seconds: 120,
  },
  {
    name: 'LM Studio',
    label: 'LM Studio (Local)',
    base_url: 'http://localhost:1234/v1',
    models: ['local-model'],
    timeout_seconds: 120,
  },
  {
    name: 'vLLM',
    label: 'vLLM Server',
    base_url: 'http://localhost:8000/v1',
    models: ['deepseek-ai/DeepSeek-R1-Distill-Qwen-14B'],
    timeout_seconds: 120,
  },
  {
    name: 'Qwen DashScope',
    label: 'Qwen (通义千问)',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwq-32b-preview'],
    timeout_seconds: 120,
  },
  {
    name: 'Zhipu GLM',
    label: 'Zhipu (智谱清言)',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    timeout_seconds: 120,
  },
  {
    name: 'Moonshot',
    label: 'Moonshot (月之暗面)',
    base_url: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    timeout_seconds: 120,
  },
  {
    name: 'Groq',
    label: 'Groq Cloud',
    base_url: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b'],
    timeout_seconds: 60,
  },
];

export const ProviderSettings: React.FC = () => {
  const { t } = useI18n();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<
    Record<string, { status: string; message: string; latency_ms?: number; model_count?: number }>
  >({});

  // Form state
  const [editingProvider, setEditingProvider] = useState<Partial<Provider>>({
    name: '',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    models: [],
    timeout_seconds: 60,
    custom_headers: {},
  });
  const [modelsInput, setModelsInput] = useState('');
  const [customHeadersInput, setCustomHeadersInput] = useState('');
  const [customHeadersError, setCustomHeadersError] = useState('');
  const [modelPricingInput, setModelPricingInput] = useState('');
  const [modelPricingError, setModelPricingError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fetchingRemote, setFetchingRemote] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState('');

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await api.getProviders();
      setProviders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleOpenAdd = () => {
    setEditingProvider({
      name: '',
      base_url: 'https://api.openai.com/v1',
      api_key: '',
      models: [],
      timeout_seconds: 60,
      custom_headers: {},
      is_default: providers.length === 0,
    });
    setModelsInput('');
    setCustomHeadersInput('');
    setCustomHeadersError('');
    setModelPricingInput('');
    setModelPricingError('');
    setShowAdvanced(false);
    setFetchedModels([]);
    setFetchError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prov: Provider) => {
    setEditingProvider({
      ...prov,
      api_key: '',
      is_default: Boolean(prov.is_default),
    });
    setModelsInput((prov.models || []).join(', '));
    const hasHeaders = prov.custom_headers && Object.keys(prov.custom_headers).length > 0;
    setCustomHeadersInput(hasHeaders ? JSON.stringify(prov.custom_headers, null, 2) : '');
    setCustomHeadersError('');
    const hasPricing = prov.model_pricing && Object.keys(prov.model_pricing).length > 0;
    setModelPricingInput(hasPricing ? JSON.stringify(prov.model_pricing, null, 2) : '');
    setModelPricingError('');
    setShowAdvanced(Boolean(hasHeaders || hasPricing || (prov.timeout_seconds && prov.timeout_seconds !== 60)));
    setFetchedModels([]);
    setFetchError('');
    setIsModalOpen(true);
  };

  const handleApplyTemplate = (tmpl: ProviderTemplate) => {
    setEditingProvider((prev) => ({
      ...prev,
      name: tmpl.name,
      base_url: tmpl.base_url,
      timeout_seconds: tmpl.timeout_seconds || 60,
      custom_headers: tmpl.custom_headers || {},
    }));
    setModelsInput(tmpl.models.join(', '));
    if (tmpl.custom_headers && Object.keys(tmpl.custom_headers).length > 0) {
      setCustomHeadersInput(JSON.stringify(tmpl.custom_headers, null, 2));
      setShowAdvanced(true);
    } else {
      setCustomHeadersInput('');
    }
    setFetchedModels([]);
    setFetchError('');
  };

  const handleFetchRemoteModels = async () => {
    if (!editingProvider.base_url) return;
    setFetchingRemote(true);
    setFetchError('');
    try {
      let headers: Record<string, string> | undefined;
      if (customHeadersInput.trim()) {
        headers = JSON.parse(customHeadersInput);
      }
      const res = await api.fetchRemoteModels({
        baseUrl: editingProvider.base_url,
        apiKey: editingProvider.api_key,
        providerId: editingProvider.id,
        customHeaders: headers,
      });

      if (res.status === 'ok' && res.models?.length > 0) {
        setFetchedModels(res.models);
      } else {
        setFetchError(res.message || 'No models returned from provider');
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to fetch models from provider');
    } finally {
      setFetchingRemote(false);
    }
  };

  const currentModelsList = modelsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleModelInclusion = (modelName: string) => {
    let updated: string[];
    if (currentModelsList.includes(modelName)) {
      updated = currentModelsList.filter((m) => m !== modelName);
    } else {
      updated = [...currentModelsList, modelName];
    }
    setModelsInput(updated.join(', '));
  };

  const handleAddAllFetched = () => {
    const combined = Array.from(new Set([...currentModelsList, ...fetchedModels]));
    setModelsInput(combined.join(', '));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let parsedHeaders: Record<string, string> = {};
    let parsedPricing: Record<string, { input: number; output: number }> = {};
    if (customHeadersInput.trim()) {
      try {
        parsedHeaders = JSON.parse(customHeadersInput);
        if (typeof parsedHeaders !== 'object' || Array.isArray(parsedHeaders)) {
          setCustomHeadersError('Headers must be a valid JSON object: { "key": "value" }');
          return;
        }
      } catch (err) {
        setCustomHeadersError('Invalid JSON format for headers');
        return;
      }
    }

    if (modelPricingInput.trim()) {
      try {
        parsedPricing = JSON.parse(modelPricingInput);
        const valid = Object.values(parsedPricing).every(
          (price) => typeof price?.input === 'number' && typeof price?.output === 'number'
        );
        if (!valid) throw new Error('invalid price');
      } catch {
        setModelPricingError(t.providers.modelPricingError);
        return;
      }
    }

    const modelsList = modelsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await api.saveProvider({
      ...editingProvider,
      models: modelsList,
      timeout_seconds: editingProvider.timeout_seconds || 60,
      custom_headers: parsedHeaders,
      model_pricing: parsedPricing,
      is_default: editingProvider.is_default,
    });
    setIsModalOpen(false);
    loadProviders();
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.setDefaultProvider(id);
      loadProviders();
    } catch (err: any) {
      alert(err.message || 'Failed to set default provider');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.providers.deleteProviderConfirm)) return;
    await api.deleteProvider(id);
    loadProviders();
  };

  const handlePing = async (id: string) => {
    setPingingId(id);
    try {
      const res = await api.pingProvider(id);
      setPingResults((prev) => ({ ...prev, [id]: res }));
    } catch (err: any) {
      setPingResults((prev) => ({
        ...prev,
        [id]: { status: 'error', message: err.message || 'Ping failed' },
      }));
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-400" />
            {t.providers.title}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {t.providers.subtitle}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{t.providers.addProvider}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-neutral-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs">{t.providers.loading}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((prov) => {
            const ping = pingResults[prov.id];
            const hasHeaders = prov.custom_headers && Object.keys(prov.custom_headers).length > 0;
            return (
              <div
                key={prov.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-neutral-100">{prov.name}</h3>
                      {prov.is_default ? (
                        <Badge variant="purple">{t.providers.defaultBadge}</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(prov.id)}
                          className="text-[10px] px-2 py-0.5 rounded border border-neutral-700/60 bg-neutral-800 text-neutral-400 hover:text-purple-300 hover:border-purple-600/50 hover:bg-purple-950/30 transition-all font-medium flex items-center gap-1"
                          title={t.providers.setAsDefault}
                        >
                          <Star className="w-2.5 h-2.5" />
                          <span>{t.providers.setAsDefault}</span>
                        </button>
                      )}
                      {prov.timeout_seconds && prov.timeout_seconds !== 60 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60 font-mono">
                          {prov.timeout_seconds}s
                        </span>
                      )}
                      {hasHeaders && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-brand-400 border border-brand-900/60 font-mono">
                          headers ({Object.keys(prov.custom_headers!).length})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePing(prov.id)}
                        disabled={pingingId === prov.id}
                        className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md transition-colors"
                        title={t.providers.testConnection}
                      >
                        {pingingId === prov.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(prov)}
                        className="px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors"
                      >
                        {t.providers.edit}
                      </button>
                      <button
                        onClick={() => handleDelete(prov.id)}
                        className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-neutral-400 mb-2 truncate">
                    {prov.base_url}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-neutral-400 mb-3">
                    <Key className="w-3.5 h-3.5 text-amber-500/80" />
                    <span className="font-mono text-[11px]">
                      {prov.has_api_key ? prov.api_key_masked : t.providers.noKeySet}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(prov.models || []).map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[11px] font-mono border border-neutral-700/60"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {ping && (
                  <div
                    className={`mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-xs ${
                      ping.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {ping.status === 'ok' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{ping.message}</span>
                    </div>
                    {ping.latency_ms !== undefined && (
                      <span className="shrink-0 text-[10px] font-mono bg-emerald-950/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/40 ml-2">
                        {ping.latency_ms}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProvider.id ? t.providers.modalEditTitle : t.providers.modalAddTitle}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Quick templates chips */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
              {t.providers.quickTemplates}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="px-2 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 hover:text-white text-neutral-300 rounded border border-neutral-700/60 transition-colors"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">{t.providers.providerName}</label>
            <input
              type="text"
              required
              value={editingProvider.name || ''}
              onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
              placeholder={t.providers.providerNamePlaceholder}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">{t.providers.baseUrl}</label>
            <input
              type="text"
              required
              value={editingProvider.base_url || ''}
              onChange={(e) => setEditingProvider({ ...editingProvider, base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">{t.providers.apiKey}</label>
            <input
              type="password"
              value={editingProvider.api_key || ''}
              onChange={(e) => setEditingProvider({ ...editingProvider, api_key: e.target.value })}
              placeholder={editingProvider.has_api_key ? `${editingProvider.api_key_masked} · leave blank to keep` : 'sk-...'}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-neutral-300">
                {t.providers.modelsLabel}
              </label>
              <button
                type="button"
                onClick={handleFetchRemoteModels}
                disabled={fetchingRemote || !editingProvider.base_url}
                className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-40 transition-colors"
                title="Query /models from API endpoint"
              >
                {fetchingRemote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{t.providers.fetchModelsBtn}</span>
              </button>
            </div>
            <input
              type="text"
              value={modelsInput}
              onChange={(e) => setModelsInput(e.target.value)}
              placeholder="deepseek-chat, deepseek-reasoner, gpt-4o"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-brand-500"
            />

            {/* Remote Models Picker */}
            {fetchingRemote && (
              <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.providers.fetchingModels}</span>
              </div>
            )}

            {fetchError && (
              <p className="text-xs text-rose-400 mt-1.5">{fetchError}</p>
            )}

            {fetchedModels.length > 0 && !fetchingRemote && (
              <div className="mt-2.5 p-2.5 bg-neutral-950/80 border border-neutral-800 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {fetchedModels.length} {t.providers.modelsFound}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddAllFetched}
                    className="text-brand-400 hover:text-brand-300 font-medium"
                  >
                    + {t.evals.selectAll}
                  </button>
                </div>
                <div className="text-[11px] text-neutral-500">{t.providers.selectModelsHint}</div>
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                  {fetchedModels.map((m) => {
                    const isIncluded = currentModelsList.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleModelInclusion(m)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
                          isIncluded
                            ? 'bg-brand-950/80 text-brand-300 border-brand-800'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        {isIncluded ? '✓ ' : '+ '}
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Advanced Settings */}
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
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {t.providers.timeoutLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="5"
                        max="600"
                        value={editingProvider.timeout_seconds || 60}
                        onChange={(e) =>
                          setEditingProvider({
                            ...editingProvider,
                            timeout_seconds: Number(e.target.value) || 60,
                          })
                        }
                        className="w-28 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <span className="text-[11px] text-neutral-500">
                      {t.providers.timeoutSecondsDesc}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {t.providers.customHeadersLabel}
                  </label>
                  <textarea
                    rows={3}
                    value={customHeadersInput}
                    onChange={(e) => {
                      setCustomHeadersInput(e.target.value);
                      setCustomHeadersError('');
                    }}
                    placeholder={t.providers.customHeadersPlaceholder}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-brand-500"
                  />
                  {customHeadersError && (
                    <p className="text-[11px] text-rose-400 mt-1">{customHeadersError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    {t.providers.modelPricingLabel}
                  </label>
                  <textarea
                    rows={4}
                    value={modelPricingInput}
                    onChange={(e) => {
                      setModelPricingInput(e.target.value);
                      setModelPricingError('');
                    }}
                    placeholder={'{\n  "model-name": { "input": 0.10, "output": 0.40 }\n}'}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">{t.providers.modelPricingHint}</p>
                  {modelPricingError && <p className="text-[11px] text-rose-400 mt-1">{modelPricingError}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Default provider checkbox */}
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80">
            <input
              type="checkbox"
              id="prov_is_default"
              checked={Boolean(editingProvider.is_default)}
              onChange={(e) =>
                setEditingProvider({ ...editingProvider, is_default: e.target.checked })
              }
              className="rounded border-neutral-700 bg-neutral-950 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="prov_is_default"
              className="text-xs text-neutral-300 cursor-pointer select-none flex items-center gap-1.5"
            >
              <Star className="w-3 h-3 text-amber-400" />
              <span>{t.providers.isDefaultLabel}</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs text-neutral-400 hover:text-neutral-200 rounded-lg transition-colors"
            >
              {t.providers.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-all"
            >
              {t.providers.saveProvider}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
