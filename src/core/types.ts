// Shared data shapes. Kept free of browser APIs so they work in tests and Node.

/** One recommended item seen on the YouTube homepage. */
export interface FeedItem {
  /** Order on the page, starting at 0 (top-left). */
  position: number;
  kind: "video" | "short";
  videoId: string;
  title: string;
  /** Channel name, or null when the page doesn't show one (e.g. Shorts). */
  channel: string | null;
  /** Channel link such as "/@handle", when shown. */
  channelUrl: string | null;
}

/** What the homepage looked like on one visit. */
export interface Snapshot {
  /** ISO 8601 time the snapshot was taken. */
  takenAt: string;
  items: FeedItem[];
  /** Ads found and skipped (counted, not stored). */
  adsSkipped: number;
}

/** What state the homepage is in when we try to read it. */
export type HomepageState =
  | "ready" // recommendations are showing
  | "history-off" // YouTube shows "Your YouTube History is off": no recommendations at all
  | "loading"; // nothing to read yet

export type TopicId = string;

export interface Topic {
  id: TopicId;
  name: string;
  /** Lowercase words or phrases that suggest this topic when found in a title or channel name. */
  keywords: string[];
  /** True for topics the user added. */
  custom?: boolean;
}

/** A correction the user made, turned into a rule. Rules always beat AI and keywords. */
export type Rule =
  | { kind: "video"; videoId: string; topic: TopicId; createdAt: string }
  | { kind: "channel"; channel: string; topic: TopicId; createdAt: string }
  | { kind: "keyword"; keyword: string; topic: TopicId; createdAt: string };

/**
 * A label the user gave by hand. Examples are the tests for rules:
 * a rule change is only kept if every example still sorts the way the user said.
 */
export interface Example {
  videoId: string;
  title: string;
  channel: string | null;
  topic: TopicId;
  createdAt: string;
}

export type GoalDirection = "more" | "less";

export interface Goal {
  direction: GoalDirection;
  /** When this goal was set; progress is measured from here. */
  since: string;
}

export type Goals = Record<TopicId, Goal>;

export type ClassificationSource = "video-rule" | "channel-rule" | "keyword-rule" | "ai" | "keywords" | "none";

export interface Classification {
  topic: TopicId;
  source: ClassificationSource;
  /** When keywords tie between topics, the tied topics (so the UI can offer them first). */
  candidates?: TopicId[];
}

/** YouTube's own feedback buttons that Feed Coach tracks (decision 0007). */
export type FeedbackKind = "dont-recommend-channel" | "not-interested";

/** The user used one of YouTube's feedback buttons on a homepage video. */
export interface FeedbackAction {
  id: string;
  kind: FeedbackKind;
  videoId: string;
  title: string;
  channel: string | null;
  takenAt: string;
  /** Noticed automatically from the click, or reported by hand in Feed Coach's menu. */
  source: "detected" | "manual";
  /** The user clicked YouTube's "Undo" right after. */
  undone?: boolean;
  /**
   * How often the channel appeared before the action, fixed when it was recorded so
   * later trimming of old snapshots can't change it. Includes the visit the action happened on.
   */
  baseline?: { visits: number; channelVisits: number };
  /** The verdict, frozen once the judging window has closed. */
  final?: FrozenResult;
}

export type ActionStatus = "measuring" | "worked" | "partly" | "didnt-work" | "undone" | "cant-check" | "no-data";

export interface FrozenResult {
  status: ActionStatus;
  beforeRate: number | null;
  afterRate: number | null;
  visitsAfter: number;
  videoCameBack: boolean;
}

/** Everything the coach knows besides snapshots. */
export interface CoachData {
  customTopics: Topic[];
  rules: Rule[];
  examples: Example[];
  goals: Goals;
  /** AI answers, by video ID, so each title is only ever sent once. */
  aiCache: Record<string, TopicId>;
  actions: FeedbackAction[];
}

export const EMPTY_COACH_DATA: CoachData = { customTopics: [], rules: [], examples: [], goals: {}, aiCache: {}, actions: [] };
