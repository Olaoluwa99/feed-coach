import { describe, expect, it } from "vitest";
import { buildPrompt, parseReply, sortBatch } from "./ai";
import { DEFAULT_TOPICS } from "./topics";

describe("buildPrompt", () => {
  it("sends only numbered titles and the topic list", () => {
    const [system, user] = buildPrompt(["Derby highlights", "Jollof recipe"], DEFAULT_TOPICS);
    expect(system?.content).toContain("- sports: Sports & football");
    expect(user?.content).toBe("0. Derby highlights\n1. Jollof recipe");
  });
});

describe("parseReply", () => {
  it("reads results, even with text around the JSON", () => {
    const text = 'Sure! ```json\n{"results":[{"i":0,"topic":"sports"},{"i":1,"topic":"food"}]}\n```';
    expect([...parseReply(text, 2, DEFAULT_TOPICS)]).toEqual([
      [0, "sports"],
      [1, "food"],
    ]);
  });

  it("drops unknown topics and out-of-range numbers, keeps 'unsorted' so it isn't asked again", () => {
    const text = '{"results":[{"i":0,"topic":"made-up"},{"i":1,"topic":"unsorted"},{"i":7,"topic":"music"},{"i":"2","topic":"music"},{"i":2,"topic":"music"}]}';
    expect([...parseReply(text, 3, DEFAULT_TOPICS)]).toEqual([
      [1, "unsorted"],
      [2, "music"],
    ]);
  });

  it("returns nothing for broken replies", () => {
    expect(parseReply("no json here", 2, DEFAULT_TOPICS).size).toBe(0);
    expect(parseReply("{not json}", 2, DEFAULT_TOPICS).size).toBe(0);
    expect(parseReply('{"results": "nope"}', 2, DEFAULT_TOPICS).size).toBe(0);
  });
});

describe("sortBatch", () => {
  const config = { endpoint: "https://example.test/v1/chat/completions", model: "m", apiKey: "k" };

  it("posts an OpenAI-style request and parses the answer", async () => {
    let sent: { url: string; body: { model: string; messages: unknown[] }; auth: string } | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization! };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"results":[{"i":0,"topic":"gaming"}]}' } }] }), { status: 200 });
    }) as typeof fetch;

    const result = await sortBatch(config, ["Minecraft speedrun"], DEFAULT_TOPICS, fakeFetch);
    expect(result.get(0)).toBe("gaming");
    expect(sent?.url).toBe(config.endpoint);
    expect(sent?.body.model).toBe("m");
    expect(sent?.auth).toBe("Bearer k");
  });

  it("explains network failures", async () => {
    const fakeFetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(sortBatch(config, ["x"], DEFAULT_TOPICS, fakeFetch)).rejects.toThrow("Couldn't reach the AI provider");
  });

  it("explains common HTTP errors", async () => {
    const fakeFetch = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    await expect(sortBatch(config, ["x"], DEFAULT_TOPICS, fakeFetch)).rejects.toThrow("Free-tier limit reached");
  });
});
