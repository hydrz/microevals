import { Language } from '../i18n';
import { Preset, TestCase } from '../types';

export const CATEGORY_DISPLAY_ORDER = [
  'Reasoning',
  'Coding',
  'Agent & Tools',
  'Simulation',
  'SVG/Art',
  'Planning',
  'Medical',
];

export const CATEGORY_NAMES_MAP: Record<string, { en: string; zh: string }> = {
  'All': { en: 'All Categories', zh: '全部分类' },
  'Reasoning': { en: 'Reasoning', zh: '推理能力' },
  'Coding': { en: 'Coding', zh: '代码编写' },
  'Agent & Tools': { en: 'Agent & Tools', zh: '智能体与工具' },
  'Simulation': { en: 'Simulation', zh: '环境模拟' },
  'SVG/Art': { en: 'SVG / Art', zh: 'SVG / 视觉图形' },
  'Planning': { en: 'Planning', zh: '规划决策' },
  'Medical': { en: 'Medical', zh: '专业医疗' },
  'General': { en: 'General', zh: '综合通用' },
};

export const getCategoryLabel = (category: string, lang: Language): string => {
  const item = CATEGORY_NAMES_MAP[category];
  if (item) {
    return lang === 'zh' ? item.zh : item.en;
  }
  return category;
};

export const getPresetTitle = (preset: Preset, lang: Language): string => {
  return lang === 'zh' && preset.title_zh ? preset.title_zh : preset.title;
};

export const getPresetDescription = (preset: Preset, lang: Language): string => {
  return lang === 'zh' && preset.description_zh ? preset.description_zh : preset.description;
};

export const getPresetCategory = (preset: Preset, lang: Language): string => {
  return lang === 'zh' && preset.category_zh ? preset.category_zh : preset.category;
};

export const getPresetTags = (preset: Preset, lang: Language): string[] => {
  return lang === 'zh' && preset.tags_zh && preset.tags_zh.length > 0
    ? preset.tags_zh
    : preset.tags || [];
};

export const getCasePrompt = (testCase: TestCase, lang: Language): string => {
  return lang === 'zh' && testCase.prompt_zh ? testCase.prompt_zh : testCase.prompt;
};

export const getCaseSystemPrompt = (testCase: TestCase, lang: Language): string | undefined => {
  return lang === 'zh' && testCase.system_prompt_zh
    ? testCase.system_prompt_zh
    : testCase.system_prompt;
};

export const getCaseGroundTruth = (testCase: TestCase, lang: Language): string | undefined => {
  return lang === 'zh' && testCase.ground_truth_zh
    ? testCase.ground_truth_zh
    : testCase.ground_truth;
};

export interface CategoryGroup {
  categoryKey: string;
  categoryLabel: string;
  presets: Preset[];
}

export const groupPresetsByCategory = (
  presets: Preset[],
  lang: Language
): CategoryGroup[] => {
  const groupsMap = new Map<string, Preset[]>();

  // Ensure established categories appear first
  for (const cat of CATEGORY_DISPLAY_ORDER) {
    groupsMap.set(cat, []);
  }

  for (const p of presets) {
    const cat = p.category || 'General';
    if (!groupsMap.has(cat)) {
      groupsMap.set(cat, []);
    }
    groupsMap.get(cat)!.push(p);
  }

  const result: CategoryGroup[] = [];
  for (const [catKey, catPresets] of groupsMap.entries()) {
    if (catPresets.length > 0) {
      result.push({
        categoryKey: catKey,
        categoryLabel: getCategoryLabel(catKey, lang),
        presets: catPresets,
      });
    }
  }

  return result;
};
