export interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key?: string;
  has_api_key: boolean;
  api_key_masked: string;
  models: string[];
  timeout_seconds?: number;
  custom_headers?: Record<string, string>;
  model_pricing?: Record<string, { input: number; output: number }>;
  is_default?: boolean;
}

export interface MetricResult {
  model_name: string;
  ttft_ms: number;
  total_latency_s: number;
  tokens_per_second: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number | null;
  input_price_per_million?: number | null;
  output_price_per_million?: number | null;
  pricing_source?: string;
  pricing_version?: string | null;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolTrace {
  tool_name: string;
  arguments: string;
  result?: any;
}

export interface TestCase {
  id: string;
  prompt: string;
  prompt_zh?: string;
  system_prompt?: string;
  system_prompt_zh?: string;
  ground_truth?: string;
  ground_truth_zh?: string;
  expected_tools?: string[];
  rule_type?: string;
  rule_config?: Record<string, any>;
}

export interface Preset {
  id: string;
  title: string;
  title_zh?: string;
  slug: string;
  description: string;
  description_zh?: string;
  category: string;
  category_zh?: string;
  vote_count: number;
  tags: string[];
  tags_zh?: string[];
  case_count: number;
  cases?: TestCase[];
}

export interface EvalSource {
  type: 'dataset' | 'preset';
  id: string;
  title?: string;
}


export interface Dataset {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at?: number;
  source_preset_id?: string | null;
  case_count: number;
  cases?: TestCase[];
}

export interface ModelBatchSummary {
  model_name: string;
  total_cases: number;
  passed_cases: number;
  failed_cases?: number;
  evaluated_cases?: number;
  unevaluated_cases?: number;
  execution_error_cases?: number;
  pass_rate: number | null;
  avg_score: number | null;
  avg_ttft_ms: number;
  avg_total_latency_s: number;
  avg_tokens_per_second: number;
  total_cost_usd: number | null;
  total_tokens: number;
}

export interface BatchCaseResult {
  case_id: string;
  model_name: string;
  prompt: string;
  output_text: string;
  metrics: MetricResult;
  eval_results: {
    evaluator_name: string;
    passed: boolean;
    score: number;
    reason: string;
  }[];
  primary_evaluator?: string | null;
  diagnostic_results?: BatchCaseResult['eval_results'];
  verdict?: 'passed' | 'failed' | 'unevaluated';
  passed: boolean | null;
  score?: number | null;
  error?: string;
}

export interface BatchRunReport {
  id: string;
  dataset_id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'partial';
  source_type?: 'dataset' | 'preset';
  source_id?: string;
  source_title?: string;
  termination_reason?: string | null;
  retry_of_run_id?: string | null;
  created_at: number;
  total_cases: number;
  completed_cases: number;
  models: any[];
  model_summaries: Record<string, ModelBatchSummary>;
  case_results: BatchCaseResult[];
  source_snapshot?: TestCase[];
  configuration?: Record<string, unknown>;
}

export interface BatchRunOptions {
  concurrency?: number;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  timeout?: number;
  system_prompt?: string;
}

export interface PlaygroundColumnState {
  id: string;
  providerId: string;
  modelName: string;
  temperature: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string;
  seed?: number;
  customSystemPrompt?: string;
  output: string;
  toolCalls: ToolCall[];
  metrics?: MetricResult;
  isStreaming: boolean;
  error?: string;
}
