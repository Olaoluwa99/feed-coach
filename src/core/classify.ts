// Decides which topic a homepage item belongs to.
// Order (decision 0006): user rules → AI cache → built-in keywords → unsorted.
import { allTopics, containsPhrase, normalize, UNSORTED } from "./topics";
import type { Classification, CoachData, FeedItem, Rule, Topic } from "./types";

type Sortable = Pick<FeedItem, "videoId" | "title" | "channel">;

export function classify(item: Sortable, data: CoachData, topics: Topic[] = allTopics(data)): Classification {
  const fromRule = byRules(item, data.rules);
  if (fromRule) return fromRule;

  const fromAi = data.aiCache[item.videoId];
  if (fromAi && topics.some((t) => t.id === fromAi)) return { topic: fromAi, source: "ai" };

  return byKeywords(item, topics);
}

interface RuleIndex {
  byVideo: Map<string, Rule>;
  byChannel: Map<string, Rule>;
  keywordsNewestFirst: Extract<Rule, { kind: "keyword" }>[];
}

// Classification runs thousands of times per page, so each rules array is indexed once.
// Rule arrays are never mutated in place (every change makes a new array), so caching by identity is safe.
const indexes = new WeakMap<Rule[], RuleIndex>();

function indexRules(rules: Rule[]): RuleIndex {
  const cached = indexes.get(rules);
  if (cached) return cached;
  // Oldest first, so a newer rule for the same target overwrites an older one.
  const oldestFirst = [...rules].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const index: RuleIndex = { byVideo: new Map(), byChannel: new Map(), keywordsNewestFirst: [] };
  for (const rule of oldestFirst) {
    if (rule.kind === "video") index.byVideo.set(rule.videoId, rule);
    else if (rule.kind === "channel") index.byChannel.set(normalize(rule.channel), rule);
    else index.keywordsNewestFirst.unshift(rule);
  }
  indexes.set(rules, index);
  return index;
}

export function byRules(item: Sortable, rules: Rule[]): Classification | null {
  if (rules.length === 0) return null;
  const index = indexRules(rules);

  const video = index.byVideo.get(item.videoId);
  if (video) return { topic: video.topic, source: "video-rule" };

  if (item.channel) {
    const byChannel = index.byChannel.get(normalize(item.channel));
    if (byChannel) return { topic: byChannel.topic, source: "channel-rule" };
  }

  if (index.keywordsNewestFirst.length > 0) {
    const title = normalize(item.title);
    // Newest keyword rule wins, so later corrections override earlier ones.
    const byKeyword = index.keywordsNewestFirst.find((r) => containsPhrase(title, r.keyword));
    if (byKeyword) return { topic: byKeyword.topic, source: "keyword-rule" };
  }

  return null;
}

/** Scores each topic by how many of its keywords appear. Title matches count double. */
export function byKeywords(item: Sortable, topics: Topic[]): Classification {
  const title = normalize(item.title);
  const channel = normalize(item.channel ?? "");
  let best = 0;
  let leaders: Topic[] = [];

  for (const topic of topics) {
    let score = 0;
    for (const keyword of topic.keywords) {
      if (containsPhrase(title, keyword)) score += 2;
      else if (containsPhrase(channel, keyword)) score += 1;
    }
    if (score === 0) continue;
    if (score > best) {
      best = score;
      leaders = [topic];
    } else if (score === best) {
      leaders.push(topic);
    }
  }

  if (leaders.length === 1) return { topic: leaders[0]!.id, source: "keywords" };
  if (leaders.length > 1) return { topic: UNSORTED, source: "none", candidates: leaders.map((t) => t.id) };
  return { topic: UNSORTED, source: "none" };
}
