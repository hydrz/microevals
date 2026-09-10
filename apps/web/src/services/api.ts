import { Dataset, Preset, Provider, BatchRunReport, EvalSource } from '../types';

const BASE_URL = '/api';

export const api = {
  // Providers
  async getProviders(): Promise<Provider[]> {
    const res = await fetch(`${BASE_URL}/providers`);
    if (!res.ok) throw new Error('Failed to fetch providers');
    return res.json();
  },

  async saveProvider(provider: Partial<Provider>): Promise<Provider> {
    const res = await fetch(`${BASE_URL}/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provider),
    });
    if (!res.ok) throw new Error('Failed to save provider');
    return res.json();
  },

  async deleteProvider(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/providers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete provider');
  },

  async pingProvider(id: string): Promise<{ status: string; message: string; code?: number; latency_ms?: number; models_count?: number }> {
    const res = await fetch(`${BASE_URL}/providers/${id}/ping`, { method: 'POST' });
    return res.json();
  },

  async setDefaultProvider(id: string): Promise<Provider> {
    const res = await fetch(`${BASE_URL}/providers/${id}/set_default`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to set default provider');
    return res.json();
  },

  async fetchRemoteModels(params: {
    baseUrl?: string;
    apiKey?: string;
    providerId?: string;
    customHeaders?: Record<string, string>;
  }): Promise<{ status: string; models: string[]; count: number; message?: string }> {
    const res = await fetch(`${BASE_URL}/providers/fetch_models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: params.baseUrl,
        api_key: params.apiKey,
        provider_id: params.providerId,
        custom_headers: params.customHeaders,
      }),
    });
    if (!res.ok) throw new Error('Failed to fetch remote models');
    return res.json();
  },

  // Presets
  async getPresets(): Promise<Preset[]> {
    const res = await fetch(`${BASE_URL}/presets`);
    if (!res.ok) throw new Error('Failed to fetch presets');
    return res.json();
  },

  async getPresetDetails(slug: string): Promise<Preset> {
    const res = await fetch(`${BASE_URL}/presets/${slug}`);
    if (!res.ok) throw new Error('Failed to fetch preset details');
    return res.json();
  },

  async clonePreset(slug: string): Promise<{ dataset_id: string; title: string }> {
    const res = await fetch(`${BASE_URL}/presets/${slug}/clone`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clone preset');
    return res.json();
  },

  // Datasets
  async getDatasets(): Promise<Dataset[]> {
    const res = await fetch(`${BASE_URL}/datasets`);
    if (!res.ok) throw new Error('Failed to fetch datasets');
    return res.json();
  },

  async getDataset(id: string): Promise<Dataset> {
    const res = await fetch(`${BASE_URL}/datasets/${id}`);
    if (!res.ok) throw new Error('Failed to fetch dataset');
    return res.json();
  },

  async createDataset(dataset: Partial<Dataset>): Promise<Dataset> {
    const res = await fetch(`${BASE_URL}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataset),
    });
    if (!res.ok) throw new Error('Failed to create dataset');
    return res.json();
  },

  async updateDataset(id: string, dataset: Partial<Dataset>): Promise<Dataset> {
    const res = await fetch(`${BASE_URL}/datasets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataset),
    });
    if (!res.ok) throw new Error('Failed to update dataset');
    return res.json();
  },

  async exportDataset(id: string, format: 'csv' | 'jsonl'): Promise<void> {
    const res = await fetch(`${BASE_URL}/datasets/${id}/export?format=${format}`);
    if (!res.ok) throw new Error('Failed to export dataset');
    const url = URL.createObjectURL(await res.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${id}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  async deleteDataset(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/datasets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete dataset');
  },

  async importDatasetFile(file: File): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/datasets/import_file`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to import dataset file');
    return res.json();
  },

  // Batch Evaluation
  async startBatchRun(
    source: EvalSource,
    models: any[],
    options?: {
      concurrency?: number;
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      timeout?: number;
      system_prompt?: string;
    } | number
  ): Promise<{ run_id: string }> {
    const opts = typeof options === 'number' ? { concurrency: options } : (options || {});
    const res = await fetch(`${BASE_URL}/evaluations/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { type: source.type, id: source.id },
        models,
        concurrency: opts.concurrency || 3,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        top_p: opts.top_p,
        timeout: opts.timeout,
        system_prompt: opts.system_prompt,
      }),
    });
    if (!res.ok) throw new Error('Failed to start evaluation run');
    return res.json();
  },

  async getBatchRuns(filters?: { status?: string; source_type?: string; search?: string }): Promise<BatchRunReport[]> {
    const query = new URLSearchParams(Object.entries(filters || {}).filter(([, value]) => Boolean(value)) as string[][]);
    const res = await fetch(`${BASE_URL}/evaluations${query.size ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch evaluation runs');
    return res.json();
  },

  async getBatchReport(runId: string): Promise<BatchRunReport> {
    const res = await fetch(`${BASE_URL}/evaluations/${runId}`);
    if (!res.ok) throw new Error('Failed to fetch evaluation report');
    return res.json();
  },

  async cancelBatchRun(runId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/evaluations/${runId}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to cancel evaluation run');
  },

  async retryBatchRun(runId: string): Promise<{ run_id: string }> {
    const res = await fetch(`${BASE_URL}/evaluations/${runId}/retry`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to retry failed evaluations');
    return res.json();
  },

  async rerunBatchRun(runId: string): Promise<{ run_id: string }> {
    const res = await fetch(`${BASE_URL}/evaluations/${runId}/rerun`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to rerun evaluation');
    return res.json();
  },
};
