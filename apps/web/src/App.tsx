import React, { useState } from 'react';
import { ActiveTab, Header } from './components/common/Header';
import { BatchEvalsView } from './components/evals/BatchEvalsView';
import { PlaygroundView } from './components/playground/PlaygroundView';
import { ProviderSettings } from './components/settings/ProviderSettings';
import { EvalSource } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('playground');
  const [targetSourceForBatch, setTargetSourceForBatch] = useState<EvalSource | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 selection:bg-brand-500 selection:text-white">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 pb-16">
        {activeTab === 'playground' && (
          <PlaygroundView />
        )}
        {activeTab === 'evals' && (
          <BatchEvalsView
            targetSource={targetSourceForBatch}
            onClearTargetSource={() => setTargetSourceForBatch(null)}
          />
        )}
        {activeTab === 'settings' && <ProviderSettings />}
      </main>
    </div>
  );
};

export default App;
