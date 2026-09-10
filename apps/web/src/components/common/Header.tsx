import React from 'react';
import { Columns3, Languages, ListChecks, Settings2, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';

export type ActiveTab = 'playground' | 'evals' | 'settings';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { language, setLanguage, t } = useI18n();

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-base tracking-tight text-white">MicroEvals</span>
            <span className="text-[11px] font-mono text-neutral-400 hidden sm:inline">
              {t.nav.logoSubtitle}
            </span>
          </div>
        </div>

        {/* Right Nav & Language Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => onTabChange('playground')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'playground'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.nav.playground}</span>
            </button>

            <button
              onClick={() => onTabChange('evals')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'evals'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.nav.evals}</span>
            </button>

            <button
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.nav.providers}</span>
            </button>
          </nav>

          {/* Language Toggle Button */}
          <button
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-xl border border-neutral-800 text-xs font-medium transition-all shadow-sm"
            title={language === 'zh' ? 'Switch to English' : '切换为简体中文'}
          >
            <Languages className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-mono text-[11px] font-semibold">
              {language === 'zh' ? '中 / EN' : 'EN / 中'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
