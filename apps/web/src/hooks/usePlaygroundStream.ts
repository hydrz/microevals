import { useState, useCallback, useRef } from 'react';
import { MetricResult, PlaygroundColumnState, ToolCall } from '../types';

export const usePlaygroundStream = () => {
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (
      columns: PlaygroundColumnState[],
      prompt: string,
      systemPrompt?: string,
      enableTools: boolean = false,
      onUpdateColumn?: (index: number, updater: (prev: PlaygroundColumnState) => PlaygroundColumnState) => void,
      targetIndices?: number[]
    ) => {
      if (isRunning) return;

      setIsRunning(true);
      abortControllerRef.current = new AbortController();

      const columnsToRun = targetIndices ? targetIndices.map((i) => columns[i]) : columns;

      const payload = {
        models: columnsToRun.map((col) => ({
          provider_id: col.providerId,
          model_name: col.modelName,
          temperature: col.temperature,
          max_tokens: col.maxTokens,
          top_p: col.topP,
          frequency_penalty: col.frequencyPenalty,
          presence_penalty: col.presencePenalty,
          stop: col.stopSequences ? col.stopSequences.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          seed: col.seed,
          custom_system_prompt: col.customSystemPrompt,
        })),
        messages: [{ role: 'user', content: prompt }],
        system_prompt: systemPrompt,
        enable_tools: enableTools,
      };

      try {
        const response = await fetch('/api/playground/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const ev of events) {
            if (!ev.trim()) continue;
            const lines = ev.split('\n');
            let eventName = '';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventName = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6).trim();
              }
            }

            if (!eventName || !dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              const targetIdx = targetIndices ? targetIndices[data.model_index] : data.model_index;

              if (eventName === 'chunk') {
                const { delta, elapsed_ms, ttft_ms } = data;
                onUpdateColumn?.(targetIdx, (col) => ({
                  ...col,
                  output: col.output + delta,
                  metrics: col.metrics
                    ? { ...col.metrics, total_latency_s: elapsed_ms / 1000 }
                    : ({
                        model_name: col.modelName,
                        ttft_ms: ttft_ms || 0,
                        total_latency_s: elapsed_ms / 1000,
                        tokens_per_second: 0,
                        input_tokens: 0,
                        output_tokens: 0,
                        estimated_cost_usd: 0,
                      } as MetricResult),
                }));
              } else if (eventName === 'tool_call') {
                const { tool_calls } = data;
                onUpdateColumn?.(targetIdx, (col) => ({
                  ...col,
                  toolCalls: tool_calls as ToolCall[],
                }));
              } else if (eventName === 'metrics') {
                const { metrics } = data;
                onUpdateColumn?.(targetIdx, (col) => ({
                  ...col,
                  metrics: metrics as MetricResult,
                }));
              } else if (eventName === 'error') {
                const { error } = data;
                onUpdateColumn?.(targetIdx, (col) => ({
                  ...col,
                  error: error,
                  isStreaming: false,
                }));
              } else if (eventName === 'done') {
                onUpdateColumn?.(targetIdx, (col) => ({
                  ...col,
                  isStreaming: false,
                }));
              }
            } catch (err) {
              console.error('Error parsing SSE data', err);
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Streaming failed:', err);
        }
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning]
  );

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsRunning(false);
    }
  }, []);

  return { isRunning, startStream, stopStream };
};
