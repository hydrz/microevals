import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, Wrench } from 'lucide-react';
import { ToolCall } from '../../types';
import { useI18n } from '../../i18n';

interface ToolCallTraceProps {
  toolCalls: ToolCall[];
}

export const ToolCallTrace: React.FC<ToolCallTraceProps> = ({ toolCalls }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(true);

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/20 overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-amber-300 font-medium hover:bg-amber-950/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-amber-400" />
          <span>{t.metrics.toolsInvoked} ({toolCalls.length})</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>


      {isOpen && (
        <div className="p-3 border-t border-amber-900/30 space-y-2">
          {toolCalls.map((tc) => {
            let formattedArgs = tc.arguments;
            try {
              formattedArgs = JSON.stringify(JSON.parse(tc.arguments), null, 2);
            } catch {}

            return (
              <div key={tc.id} className="bg-neutral-950/80 rounded border border-neutral-800 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal className="w-3 h-3 text-sky-400" />
                  <span className="font-mono font-semibold text-neutral-200">{tc.name}</span>
                  <span className="text-[10px] font-mono text-neutral-500">ID: {tc.id}</span>
                </div>
                <pre className="font-mono text-[11px] text-amber-200/90 overflow-x-auto p-1.5 bg-neutral-900/50 rounded">
                  {formattedArgs}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
