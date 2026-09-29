/**
 * Fetch-based adapter for any OpenAI-compatible `/v1/chat/completions` endpoint (OpenAI, Azure
 * OpenAI-compatible gateways, OpenRouter, vLLM, Ollama, LM Studio, and the OpenAI-compatible
 * endpoints of other vendors). No SDK. Never called in tests.
 *
 * Environment: MARCO_AI_BASE_URL (e.g. https://api.openai.com/v1 or http://localhost:11434),
 * MARCO_AI_MODEL, MARCO_AI_API_KEY (optional for local servers).
 */
import type { ChatMessage, CompleteOptions, Provider } from '../types.js';

export interface OpenAICompatibleOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Extra request headers. */
  headers?: Record<string, string>;
  /** Default sampling temperature; per-call options win. */
  temperature?: number;
  /** Default max output tokens; per-call options win. */
  maxTokens?: number;
  /** Request timeout; default 600 000 ms (10 min). */
  timeoutMs?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

/**
 * Endpoint URL from a base URL: a bare host gets `/v1/chat/completions`, a base with a path
 * (`…/v1`, `…/v1beta/openai`) gets `/chat/completions`, a full endpoint is used as is.
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const p = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(p)) url.pathname = p;
  else if (p === '') url.pathname = '/v1/chat/completions';
  else url.pathname = `${p}/chat/completions`;
  return url.toString();
}

export interface ChatCompletionResponse {
  choices?: { message?: { content?: unknown }; finish_reason?: string }[];
  error?: { message?: string };
}

/** Reply text of a chat-completions response (string content or an array of text parts). */
export function readChatCompletion(json: ChatCompletionResponse): string {
  const content = json.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: unknown) =>
        part && typeof part === 'object' && 'text' in part
          ? String((part as { text: unknown }).text)
          : '',
      )
      .join('');
  }
  const reason = json.error?.message ? `: ${json.error.message}` : '';
  throw new Error(`no message content in response${reason}`);
}

/** URL and fetch init for one call; pure, so it can be checked without a network. */
export function buildChatCompletionRequest(
  options: OpenAICompatibleOptions,
  messages: ChatMessage[],
  opts: CompleteOptions = {},
): { url: string; init: { method: 'POST'; headers: Record<string, string>; body: string } } {
  const body: Record<string, unknown> = { model: options.model, messages };
  const temperature = opts.temperature ?? options.temperature;
  const maxTokens = opts.maxTokens ?? options.maxTokens;
  if (temperature !== undefined) body['temperature'] = temperature;
  if (maxTokens !== undefined) body['max_tokens'] = maxTokens;
  return {
    url: chatCompletionsUrl(options.baseUrl),
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
        ...options.headers,
      },
      body: JSON.stringify(body),
    },
  };
}

export class OpenAICompatibleProvider implements Provider {
  readonly name: string;

  constructor(private readonly options: OpenAICompatibleOptions) {
    if (!options.baseUrl) throw new Error('baseUrl is required');
    if (!options.model) throw new Error('model is required');
    this.name = `openai-compatible:${options.model}`;
  }

  async complete(messages: ChatMessage[], opts: CompleteOptions = {}): Promise<string> {
    const { url, init } = buildChatCompletionRequest(this.options, messages, opts);
    const timeout = AbortSignal.timeout(this.options.timeoutMs ?? 600_000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const doFetch = this.options.fetch ?? fetch;
    const res = await doFetch(url, { ...init, signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${this.name}: HTTP ${res.status} ${text.slice(0, 500)}`);
    }
    return readChatCompletion((await res.json()) as ChatCompletionResponse);
  }
}

/** Build the adapter from MARCO_AI_BASE_URL, MARCO_AI_MODEL and MARCO_AI_API_KEY. */
export function openAICompatibleFromEnv(
  env: Record<string, string | undefined> = process.env,
): OpenAICompatibleProvider {
  const baseUrl = env['MARCO_AI_BASE_URL'];
  const model = env['MARCO_AI_MODEL'];
  if (!baseUrl || !model) {
    throw new Error(
      'set MARCO_AI_BASE_URL and MARCO_AI_MODEL (and MARCO_AI_API_KEY if the endpoint needs one)',
    );
  }
  const options: OpenAICompatibleOptions = { baseUrl, model };
  if (env['MARCO_AI_API_KEY']) options.apiKey = env['MARCO_AI_API_KEY'];
  return new OpenAICompatibleProvider(options);
}
