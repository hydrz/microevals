import React, { useRef, useState } from 'react';
import { Database, Download, FileUp, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { Dataset, TestCase } from '../../types';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n';

interface Props {
  datasets: Dataset[];
  onRefresh: () => void;
  onSelectRun: (dataset: Dataset) => void;
}

const emptyCase = (index: number): TestCase => ({ id: `new_${index}`, prompt: '', expected_tools: [], rule_config: {} });
const inputClass = 'mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-brand-500';

export const DatasetManager: React.FC<Props> = ({ datasets, onRefresh, onSelectRun }) => {
  const { t, language } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<Dataset | null>(null);
  const [selectedCase, setSelectedCase] = useState(0);
  const [error, setError] = useState('');

  const openNew = () => {
    setEditing({ id: '', name: '', description: '', created_at: 0, case_count: 1, cases: [emptyCase(1)] });
    setSelectedCase(0);
    setError('');
  };

  const openEdit = async (dataset: Dataset) => {
    const full = await api.getDataset(dataset.id);
    setEditing({ ...full, cases: full.cases?.length ? full.cases : [emptyCase(1)] });
    setSelectedCase(0);
    setError('');
  };

  const updateCase = (patch: Partial<TestCase>) => {
    if (!editing) return;
    const cases = [...(editing.cases || [])];
    cases[selectedCase] = { ...cases[selectedCase], ...patch };
    setEditing({ ...editing, cases, case_count: cases.length });
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return setError(language === 'zh' ? '数据集名称不能为空。' : 'Dataset name is required.');
    if (!(editing.cases || []).every((item) => item.prompt.trim())) return setError(language === 'zh' ? '每个用例都需要提示词。' : 'Every case needs a prompt.');
    try {
      if (editing.id) await api.updateDataset(editing.id, editing);
      else await api.createDataset(editing);
      setEditing(null);
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save dataset.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.evals.deleteDatasetConfirm)) return;
    await api.deleteDataset(id);
    onRefresh();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await api.importDatasetFile(file);
      onRefresh();
    } catch (reason) {
      console.error('Import failed', reason);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentCase = editing?.cases?.[selectedCase];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-200"><Database className="h-4 w-4 text-emerald-400" />{t.evals.title} ({datasets.length})</h3>
          <p className="text-xs text-neutral-500">{t.evals.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.jsonl" onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"><FileUp className="h-3.5 w-3.5" />{t.evals.uploadCsv}</button>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"><Plus className="h-3.5 w-3.5" />{t.evals.newDataset}</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="hidden grid-cols-[minmax(0,2fr)_90px_140px_250px] gap-3 border-b border-neutral-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 md:grid"><span>{language === 'zh' ? '数据集' : 'Dataset'}</span><span>{language === 'zh' ? '用例' : 'Cases'}</span><span>{language === 'zh' ? '更新日期' : 'Updated'}</span><span className="text-right">{language === 'zh' ? '操作' : 'Actions'}</span></div>
        {datasets.length === 0 && <p className="px-4 py-8 text-center text-xs text-neutral-500">{language === 'zh' ? '还没有数据集，请导入或创建第一个数据集。' : 'No datasets yet. Import one or create your first dataset.'}</p>}
        {datasets.map((dataset) => (
          <div key={dataset.id} className="grid gap-3 border-b border-neutral-800/70 px-4 py-3 last:border-0 md:grid-cols-[minmax(0,2fr)_90px_140px_250px] md:items-center">
            <div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-sm text-neutral-100">{dataset.name}</strong>{dataset.source_preset_id && <span className="rounded bg-purple-950 px-1.5 py-0.5 text-[10px] text-purple-300">{language === 'zh' ? '定制副本' : 'customized'}</span>}</div><p className="truncate text-xs text-neutral-500">{dataset.description || t.evals.noDescription}</p></div>
            <span className="text-xs tabular-nums text-neutral-300">{dataset.case_count}</span>
            <span className="text-xs text-neutral-500">{new Date((dataset.updated_at || dataset.created_at) * 1000).toLocaleDateString()}</span>
            <div className="flex justify-end gap-1.5">
              <button onClick={() => onSelectRun(dataset)} title="Run" className="rounded-md p-2 text-brand-300 hover:bg-brand-950"><Play className="h-3.5 w-3.5 fill-current" /></button>
              <button onClick={() => openEdit(dataset)} title="Edit" className="rounded-md p-2 text-neutral-300 hover:bg-neutral-800"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => api.exportDataset(dataset.id, 'csv')} title="Export CSV" className="rounded-md px-2 py-1.5 text-[10px] font-semibold text-neutral-400 hover:bg-neutral-800">CSV</button>
              <button onClick={() => api.exportDataset(dataset.id, 'jsonl')} title="Export JSONL" className="rounded-md p-2 text-neutral-400 hover:bg-neutral-800"><Download className="h-3.5 w-3.5" /></button>
              <button onClick={() => handleDelete(dataset.id)} title="Delete" className="rounded-md p-2 text-neutral-500 hover:bg-neutral-800 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? (language === 'zh' ? '编辑数据集' : 'Edit dataset') : (language === 'zh' ? '创建数据集' : 'Create dataset')} maxWidth="xl">
        {editing && currentCase && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Dataset name" className={inputClass} />
              <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Description" className={inputClass} />
            </div>
            <div className="grid min-h-[420px] gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="rounded-lg border border-neutral-800 bg-neutral-950 p-2">
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold text-neutral-400"><span>{language === 'zh' ? '测试用例' : 'Test cases'}</span><button onClick={() => { const cases = [...(editing.cases || []), emptyCase((editing.cases?.length || 0) + 1)]; setEditing({ ...editing, cases, case_count: cases.length }); setSelectedCase(cases.length - 1); }} className="rounded p-1 text-brand-300 hover:bg-neutral-800"><Plus className="h-3.5 w-3.5" /></button></div>
                <div className="space-y-1">{editing.cases?.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => setSelectedCase(index)} className={`block w-full truncate rounded-md px-2 py-2 text-left text-xs ${index === selectedCase ? 'bg-brand-950 text-brand-200' : 'text-neutral-400 hover:bg-neutral-900'}`}>{index + 1}. {item.prompt || 'Untitled case'}</button>)}</div>
              </aside>
              <div className="space-y-3">
                <label className="block text-xs text-neutral-400">{language === 'zh' ? '提示词' : 'Prompt'}<textarea rows={4} value={currentCase.prompt} onChange={(e) => updateCase({ prompt: e.target.value })} className={inputClass} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-neutral-400">{language === 'zh' ? '系统提示词' : 'System prompt'}<textarea rows={3} value={currentCase.system_prompt || ''} onChange={(e) => updateCase({ system_prompt: e.target.value })} className={inputClass} /></label>
                  <label className="text-xs text-neutral-400">{language === 'zh' ? '参考答案' : 'Reference / ground truth'}<textarea rows={3} value={currentCase.ground_truth || ''} onChange={(e) => updateCase({ ground_truth: e.target.value })} className={inputClass} /></label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-neutral-400">{language === 'zh' ? '预期工具' : 'Expected tools'}<input value={(currentCase.expected_tools || []).join(', ')} onChange={(e) => updateCase({ expected_tools: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="search, calculator" className={inputClass} /></label>
                  <label className="text-xs text-neutral-400">{language === 'zh' ? '主评估器' : 'Primary evaluator'}<select value={currentCase.rule_type || ''} onChange={(e) => updateCase({ rule_type: e.target.value || undefined })} className={inputClass}><option value="">None</option><option value="contains">Contains</option><option value="exact_match">Exact match</option><option value="regex">Regex</option><option value="json_schema">JSON schema</option><option value="numeric_range">Numeric range</option><option value="tool_call">Tool call</option></select></label>
                  <label className="text-xs text-neutral-400">{language === 'zh' ? '评估器配置（JSON）' : 'Evaluator config (JSON)'}<input defaultValue={JSON.stringify(currentCase.rule_config || {})} onBlur={(e) => { try { updateCase({ rule_config: JSON.parse(e.target.value) }); setError(''); } catch { setError(language === 'zh' ? '评估器配置必须是有效 JSON。' : 'Evaluator config must be valid JSON.'); } }} className={`${inputClass} font-mono text-xs`} /></label>
                </div>
                <button onClick={() => { const cases = (editing.cases || []).filter((_, index) => index !== selectedCase); if (cases.length) { setEditing({ ...editing, cases, case_count: cases.length }); setSelectedCase(Math.max(0, selectedCase - 1)); } }} disabled={(editing.cases?.length || 0) <= 1} className="text-xs text-rose-400 disabled:opacity-40">{language === 'zh' ? '删除此用例' : 'Remove this case'}</button>
              </div>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3"><button onClick={() => setEditing(null)} className="px-4 py-2 text-xs text-neutral-400">{language === 'zh' ? '取消' : 'Cancel'}</button><button onClick={save} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500">{language === 'zh' ? '保存数据集' : 'Save dataset'}</button></div>
          </div>
        )}
      </Modal>
    </section>
  );
};
