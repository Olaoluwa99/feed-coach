// Optional AI sorting (decision 0006): only used if the user turns it on with their own key.
// Only video titles are sent: no channel names, times or account details.
// Uses the OpenAI-compatible chat completions API of the providers below (the only
// hosts listed in the manifest's optional_host_permissions).
import { UNSORTED } from "./topics";
import type { Topic, TopicId } from "./types";

export const BATCH_SIZE = 25;

export const PROVIDERS = [
  { name: "Google Gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.5-flash" },
  { name: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.1-8b-instant" },
  { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.1-8b-instruct:free" },
] as const;

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function buildPrompt(titles: string[], topics: Topic[]): ChatMessage[] {
  const topicList = topics.map((t) => `- ${t.id}: ${t.name}`).join("\n");
  return [
    {
      role: "system",
      content:
        "You sort YouTube video titles into topics. " +
        `Use only these topic ids, or "${UNSORTED}" if none clearly fits:\n${topicList}\n\n` +
        'Reply with JSON only, no other text: {"results":[{"i":<title number>,"topic":"<topic id>"}]}',
    },
    { role: "user", content: titles.map((title, i) => `${i}. ${title}`).join("\n") },
  ];
}

/** Give up on an AI request after this long (Chrome stops service workers waiting ~30s on a fetch). */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Reads the model's reply defensively: takes the first JSON object in the text,
 * ignores unknown topics and out-of-range numbers. Returns topic per title index.
 * "unsorted" answers are kept, so the caller can remember them and not ask again.
 */
export function parseReply(text: string, count: number, topics: Topic[]): Map<number, TopicId> {
  const result = new Map<number, TopicId>();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return result;
  }

  const rows = (parsed as { results?: unknown }).results;
  if (!Array.isArray(rows)) return result;
  const valid = new Set([...topics.map((t) => t.id), UNSORTED]);

  for (const row of rows) {
    const { i, topic } = (row ?? {}) as { i?: unknown; topic?: unknown };
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= count) continue;
    if (typeof topic !== "string" || !valid.has(topic)) continue; // made-up topics are dropped
    result.set(i, topic);
  }
  return result;
}

export interface AiConfig {
  endpoint: string;
  model: string;
  apiKey: string;
}

/** Sorts up to BATCH_SIZE titles. Throws with a readable message on HTTP errors or timeout. */
export async function sortBatch(config: AiConfig, titles: string[], topics: Topic[], fetchFn: typeof fetch = fetch): Promise<Map<number, TopicId>> {
  let response: Response;
  try {
    response = await fetchFn(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, temperature: 0, messages: buildPrompt(titles, topics) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new Error("The AI provider took too long to answer.");
    throw new Error("Couldn't reach the AI provider. Check the endpoint and your connection.");
  }
  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 ? " Check your API key." : response.status === 429 ? " Free-tier limit reached; try later." : "";
    throw new Error(`AI request failed (${response.status}).${hint}`);
  }
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return parseReply(body.choices?.[0]?.message?.content ?? "", titles.length, topics);
}
