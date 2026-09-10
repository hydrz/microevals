import React from 'react';
import { useI18n } from '../../i18n';

interface DiffViewerProps {
  textA: string;
  textB: string;
  labelA?: string;
  labelB?: string;
}

// Simple token diff helper
function computeWordDiff(str1: string, str2: string) {
  const words1 = str1.split(/(\s+)/);
  const words2 = str2.split(/(\s+)/);

  const set2 = new Set(words2.filter((w) => w.trim()));
  const set1 = new Set(words1.filter((w) => w.trim()));

  return {
    diffA: words1.map((w, idx) => ({
      word: w,
      isUnique: w.trim().length > 0 && !set2.has(w),
      key: `a_${idx}`,
    })),
    diffB: words2.map((w, idx) => ({
      word: w,
      isUnique: w.trim().length > 0 && !set1.has(w),
      key: `b_${idx}`,
    })),
  };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  textA,
  textB,
  labelA = 'Model A',
  labelB = 'Model B',
}) => {
  const { t } = useI18n();
  const { diffA, diffB } = computeWordDiff(textA, textB);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono bg-neutral-950 p-3 rounded-lg border border-neutral-800">
      <div className="border-r border-neutral-800 pr-2">
        <div className="text-[11px] font-semibold text-neutral-400 mb-2 pb-1 border-b border-neutral-800 flex items-center justify-between">
          <span>{labelA}</span>
          <span className="text-rose-400 font-normal">{t.metrics.uniqueWords}</span>
        </div>
        <div className="whitespace-pre-wrap leading-relaxed text-neutral-300">
          {diffA.map((item) =>
            item.isUnique ? (
              <span key={item.key} className="bg-rose-950/70 text-rose-300 px-1 py-0.5 rounded">
                {item.word}
              </span>
            ) : (
              <span key={item.key}>{item.word}</span>
            )
          )}
        </div>
      </div>

      <div className="pl-2">
        <div className="text-[11px] font-semibold text-neutral-400 mb-2 pb-1 border-b border-neutral-800 flex items-center justify-between">
          <span>{labelB}</span>
          <span className="text-emerald-400 font-normal">{t.metrics.uniqueWords}</span>
        </div>
        <div className="whitespace-pre-wrap leading-relaxed text-neutral-300">
          {diffB.map((item) =>
            item.isUnique ? (
              <span key={item.key} className="bg-emerald-950/70 text-emerald-300 px-1 py-0.5 rounded">
                {item.word}
              </span>
            ) : (
              <span key={item.key}>{item.word}</span>
            )
          )}
        </div>
      </div>
    </div>
  );
};

