// Built-in everyday topics and the keywords that suggest them.
// Keywords are matched as whole words/phrases in the lowercased title and channel name.
// This list is a starting point: user corrections and custom topics do most of the work.
import type { CoachData, Topic, TopicId } from "./types";

export const UNSORTED: TopicId = "unsorted";

export const DEFAULT_TOPICS: Topic[] = [
  {
    id: "music",
    name: "Music",
    keywords: ["music", "song", "songs", "official video", "official music video", "lyrics", "lyric video", "audio", "album", "remix", "live performance", "concert", "cover", "acoustic", "afrobeats", "amapiano", "hip hop", "rap", "kpop", "playlist", "mixtape", "dj", "freestyle", "gospel music", "worship songs"],
  },
  {
    id: "gaming",
    name: "Gaming",
    keywords: ["gameplay", "gaming", "minecraft", "fortnite", "roblox", "gta", "call of duty", "fifa", "ea fc", "efootball", "pubg", "free fire", "valorant", "league of legends", "playstation", "ps5", "xbox", "nintendo", "speedrun", "walkthrough", "esports", "lets play", "let s play", "boss fight"],
  },
  {
    id: "sports",
    name: "Sports & football",
    keywords: ["football", "soccer", "premier league", "champions league", "la liga", "serie a", "bundesliga", "afcon", "world cup", "goal", "goals", "highlights", "match", "transfer", "nba", "basketball", "boxing", "ufc", "mma", "tennis", "athletics", "f1", "formula 1", "cricket", "messi", "ronaldo", "arsenal", "chelsea", "liverpool", "man united", "manchester united", "manchester city", "real madrid", "barcelona", "super eagles"],
  },
  {
    id: "comedy",
    name: "Comedy & skits",
    keywords: ["comedy", "funny", "skit", "skits", "prank", "pranks", "stand up", "standup", "sketch", "try not to laugh", "memes", "meme", "parody", "jokes"],
  },
  {
    id: "gossip",
    name: "Celebrity, gossip & drama",
    keywords: ["gossip", "drama", "exposed", "beef", "feud", "breakup", "divorce", "cheating", "scandal", "celebrity", "celebrities", "tea", "shade", "clapback", "reacts to", "reaction", "storytime", "tea time", "messy", "caught", "leaked", "baby mama", "baby daddy", "bbnaija", "big brother", "love island", "reality show"],
  },
  {
    id: "news",
    name: "News & politics",
    keywords: ["news", "breaking", "live news", "politics", "political", "election", "elections", "president", "senate", "government", "minister", "governor", "parliament", "policy", "protest", "war", "debate", "headlines", "press conference", "inflation", "tinubu", "trump", "biden"],
  },
  {
    id: "education",
    name: "Learning & education",
    keywords: ["explained", "explainer", "tutorial", "lesson", "lessons", "course", "lecture", "how to", "learn", "learning", "study", "exam", "waec", "jamb", "history of", "documentary", "for beginners", "guide", "class", "math", "mathematics", "physics", "chemistry", "biology", "english grammar"],
  },
  {
    id: "tech",
    name: "Science & tech",
    keywords: ["tech", "technology", "science", "scientist", "iphone", "android", "samsung", "smartphone", "laptop", "unboxing", "review", "ai", "artificial intelligence", "chatgpt", "coding", "programming", "software", "developer", "computer", "gadget", "gadgets", "space", "nasa", "robot", "robots"],
  },
  {
    id: "food",
    name: "Cooking & food",
    keywords: ["recipe", "recipes", "cooking", "cook", "how to make", "kitchen", "chef", "food", "foods", "baking", "bake", "cake", "jollof", "egusi", "suya", "street food", "mukbang", "taste test", "restaurant", "meal prep", "breakfast", "dinner", "lunch"],
  },
  {
    id: "fitness",
    name: "Fitness & health",
    keywords: ["workout", "workouts", "fitness", "gym", "exercise", "exercises", "abs", "weight loss", "lose weight", "diet", "health", "healthy", "yoga", "running", "muscle", "bodybuilding", "calisthenics", "nutrition", "doctor", "mental health"],
  },
  {
    id: "beauty",
    name: "Beauty & fashion",
    keywords: ["makeup", "make up", "skincare", "skin care", "beauty", "hair", "hairstyle", "hairstyles", "wig", "wigs", "braids", "fashion", "outfit", "outfits", "style", "nails", "grwm", "get ready with me", "haul", "lookbook"],
  },
  {
    id: "money",
    name: "Money & business",
    keywords: ["money", "business", "entrepreneur", "invest", "investing", "investment", "stocks", "stock market", "crypto", "bitcoin", "forex", "trading", "side hustle", "make money", "passive income", "salary", "finance", "financial", "budget", "startup", "real estate", "economy"],
  },
  {
    id: "movies",
    name: "Movies & TV",
    keywords: ["movie", "movies", "film", "films", "full movie", "trailer", "official trailer", "series", "episode", "season", "netflix", "nollywood", "bollywood", "hollywood", "anime", "cartoon", "recap", "ending explained", "cinema", "tv show"],
  },
  {
    id: "faith",
    name: "Faith & spirituality",
    keywords: ["sermon", "church", "pastor", "prayer", "prayers", "pray", "bible", "jesus", "god", "worship", "praise", "gospel", "quran", "islam", "islamic", "mosque", "ramadan", "devotion", "spiritual", "spirituality", "meditation"],
  },
  {
    id: "travel",
    name: "Travel & places",
    keywords: ["travel", "travelling", "traveling", "trip", "vlog", "tour", "tourist", "visit", "visiting", "vacation", "holiday", "airport", "flight", "city tour", "country", "abroad", "relocate", "japa", "living in"],
  },
  {
    id: "vehicles",
    name: "Cars & vehicles",
    keywords: ["car", "cars", "truck", "motorcycle", "bike", "supercar", "toyota", "honda", "mercedes", "bmw", "tesla", "lamborghini", "ferrari", "car review", "test drive", "drift", "racing"],
  },
  {
    id: "kids",
    name: "Kids",
    keywords: ["kids", "for kids", "nursery rhymes", "children", "cocomelon", "toddler", "baby shark", "cartoon for kids", "abc song", "learning for kids"],
  },
  {
    id: "relationships",
    name: "Relationships & life advice",
    keywords: ["relationship", "relationships", "dating", "marriage", "married", "boyfriend", "girlfriend", "husband", "wife", "love", "advice", "self improvement", "motivation", "motivational", "podcast", "life lessons", "mindset", "discipline", "productivity"],
  },
];

export function allTopics(data: Pick<CoachData, "customTopics">): Topic[] {
  return [...DEFAULT_TOPICS, ...data.customTopics];
}

export function topicName(topics: Topic[], id: TopicId): string {
  if (id === UNSORTED) return "Unsorted";
  return topics.find((t) => t.id === id)?.name ?? id;
}

/** Lowercase, strip accents and punctuation, collapse spaces. Keywords and titles go through this. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Keywords are checked thousands of times per page, so their normalized form is cached.
const normalizedPhrases = new Map<string, string>();

/** Whole-word/phrase match: "ai" matches "new ai tools" but not "said". */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  let p = normalizedPhrases.get(phrase);
  if (p === undefined) {
    p = normalize(phrase);
    normalizedPhrases.set(phrase, p);
  }
  return p.length > 0 && ` ${normalizedText} `.includes(` ${p} `);
}

/** A short, stable ID for a user-made topic name. */
export function makeTopicId(name: string, existing: Topic[]): TopicId {
  const base = `custom-${normalize(name).replace(/ /g, "-") || "topic"}`;
  let id = base;
  for (let n = 2; existing.some((t) => t.id === id); n++) id = `${base}-${n}`;
  return id;
}
