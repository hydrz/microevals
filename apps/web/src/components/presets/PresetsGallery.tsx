import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Code2,
  Copy,
  Cpu,
  Eye,
  Layers,
  LayoutGrid,
  Play,
  Search,
  Sparkles,
  Tag,
  Wrench,
} from 'lucide-react';
import { api } from '../../services/api';
import { Preset } from '../../types';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n';
import {
  CATEGORY_DISPLAY_ORDER,
  getCategoryLabel,
  getPresetTitle,
  getPresetDescription,
  getPresetTags,
  getCasePrompt,
  getCaseGroundTruth,
  groupPresetsByCategory,
} from '../../utils/presetHelpers';

interface PresetsGalleryProps {
  onLoadIntoPlayground: (preset: Preset) => void;
  onRunBatch: (preset: Preset) => void;
}

export const PresetsGallery: React.FC<PresetsGalleryProps> = ({
  onLoadIntoPlayground,
  onRunBatch,
}) => {
  const { t, language } = useI18n();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');
  const [previewPreset, setPreviewPreset] = useState<Preset | null>(null);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        setLoading(true);
        const data = await api.getPresets();
        setPresets(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPresets();
  }, []);

  const categories = ['All', ...CATEGORY_DISPLAY_ORDER];

  const getCategoryCount = (cat: string) => {
    if (cat === 'All') return presets.length;
    return presets.filter((p) => (p.category || 'General') === cat).length;
  };

  const filteredPresets = presets.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const titleEn = (p.title || '').toLowerCase();
    const titleZh = (p.title_zh || '').toLowerCase();
    const descEn = (p.description || '').toLowerCase();
    const descZh = (p.description_zh || '').toLowerCase();
    const tagsEn = (p.tags || []).map((tag) => tag.toLowerCase());
    const tagsZh = (p.tags_zh || []).map((tag) => tag.toLowerCase());
    return (
      titleEn.includes(s) ||
      titleZh.includes(s) ||
      descEn.includes(s) ||
      descZh.includes(s) ||
      tagsEn.some((tag) => tag.includes(s)) ||
      tagsZh.some((tag) => tag.includes(s))
    );
  });

  const groupedPresets = groupPresetsByCategory(filteredPresets, language);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Reasoning':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'Coding':
        return <Code2 className="w-3.5 h-3.5 text-sky-400" />;
      case 'Simulation':
        return <Cpu className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Agent & Tools':
        return <Wrench className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <BookOpen className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const renderPresetCard = (preset: Preset) => {
    const title = getPresetTitle(preset, language);
    const description = getPresetDescription(preset, language);
    const categoryLabel = getCategoryLabel(preset.category || 'General', language);
    const tags = getPresetTags(preset, language);

    return (
      <div
        key={preset.id}
        className="bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 rounded-xl p-4 flex flex-col justify-between transition-all group shadow-sm hover:shadow-md"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              {getCategoryIcon(preset.category)}
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                {categoryLabel}
              </span>
            </div>
            <Badge variant="purple">
              {preset.case_count} {t.presets.promptsCount}
            </Badge>
          </div>

          <h3 className="text-sm font-bold text-neutral-100 group-hover:text-brand-400 transition-colors mb-1.5">
            {title}
          </h3>

          <p className="text-xs text-neutral-400 leading-relaxed mb-3 line-clamp-2">
            {description || 'Curated benchmark test cases for prompt engineering and model evaluation.'}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-400 border border-neutral-800"
              >
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPreviewPreset(preset)}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg transition-colors"
              title={t.presets.previewCases}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onLoadIntoPlayground(preset)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-sky-400 fill-sky-400" />
              <span>{t.presets.playgroundBtn}</span>
            </button>
          </div>

          <button
            onClick={() => onRunBatch(preset)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-950 hover:bg-purple-900/80 border border-purple-800 text-purple-300 text-xs font-medium rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{t.presets.cloneAndBatch}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            {t.presets.title}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            {t.presets.subtitle}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border border-neutral-800 rounded-lg p-0.5 bg-neutral-900/60">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title={t.presets.viewGrid}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{t.presets.viewGrid}</span>
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'grouped'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title={t.presets.viewGrouped}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.presets.viewGrouped}</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder={t.presets.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {categories.map((cat) => {
            const count = getCategoryCount(cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <span>{getCategoryLabel(cat, language)}</span>
                <span className="text-[10px] opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preset Cards Display */}
      {loading ? (
        <div className="text-center py-12 text-neutral-500 text-xs">{t.presets.loading}</div>
      ) : filteredPresets.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 text-xs">
          No benchmarks match your criteria.
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-8">
          {groupedPresets.map((group) => (
            <div key={group.categoryKey} className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                {getCategoryIcon(group.categoryKey)}
                <h3 className="text-sm font-bold text-neutral-200">
                  {group.categoryLabel}
                </h3>
                <span className="text-xs text-neutral-500 font-mono">
                  ({group.presets.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.presets.map(renderPresetCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresets.map(renderPresetCard)}
        </div>
      )}

      {/* Preview Preset Test Cases Modal */}
      {previewPreset && (
        <Modal
          isOpen={!!previewPreset}
          onClose={() => setPreviewPreset(null)}
          title={`${t.presets.modalTitlePrefix} ${getPresetTitle(previewPreset, language)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-400 pb-2 border-b border-neutral-800">
              <span className="truncate max-w-md">{getPresetDescription(previewPreset, language)}</span>
              <button
                onClick={() => {
                  const p = previewPreset;
                  setPreviewPreset(null);
                  onRunBatch(p);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 text-xs font-semibold rounded-lg shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t.presets.cloneAndRunBatch}</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {(previewPreset.cases || []).map((tc, idx) => (
                <div
                  key={tc.id || idx}
                  className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-neutral-400">
                      {t.presets.promptNum} #{idx + 1}
                    </span>
                    <button
                      onClick={() => {
                        const customPreset = { ...previewPreset, cases: [tc] };
                        setPreviewPreset(null);
                        onLoadIntoPlayground(customPreset);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-300 text-[11px] font-medium rounded-md transition-colors"
                    >
                      <Play className="w-3 h-3 fill-sky-300" />
                      <span>{t.presets.testInPlayground}</span>
                    </button>
                  </div>

                  <p className="text-xs text-neutral-200 font-sans whitespace-pre-wrap">
                    {getCasePrompt(tc, language)}
                  </p>

                  {getCaseGroundTruth(tc, language) && (
                    <div className="text-[11px] text-emerald-400/90 font-mono bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/40">
                      <span className="text-neutral-400">{t.presets.targetGroundTruth} </span>
                      {getCaseGroundTruth(tc, language)}
                    </div>
                  )}

                  {tc.expected_tools && tc.expected_tools.length > 0 && (
                    <div className="text-[11px] text-amber-400/90 font-mono bg-amber-950/30 px-2 py-1 rounded border border-amber-900/40">
                      <span className="text-neutral-400">{t.presets.expectedTool} </span>
                      {tc.expected_tools.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
