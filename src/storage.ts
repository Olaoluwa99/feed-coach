// Everything is stored in chrome.storage.local: on this computer only, never uploaded.
import { EMPTY_COACH_DATA, type CoachData, type HomepageState, type Snapshot } from "./core/types";

export interface AiSettings {
  enabled: boolean;
  /** OpenAI-compatible chat completions URL. */
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface UiPrefs {
  panelCollapsed: boolean;
  markersHidden: boolean;
}

interface Stored {
  snapshots: Snapshot[];
  lastState: { state: HomepageState; at: string } | null;
  coach: CoachData;
  ai: AiSettings;
  ui: UiPrefs;
}

export const DEFAULT_UI: UiPrefs = { panelCollapsed: false, markersHidden: false };

async function get<K extends keyof Stored>(key: K): Promise<Stored[K] | undefined> {
  const result = (await chrome.storage.local.get(key)) as Partial<Stored>;
  return result[key];
}

export async function getSnapshots(): Promise<Snapshot[]> {
  return (await get("snapshots")) ?? [];
}

export async function setSnapshots(snapshots: Snapshot[]): Promise<void> {
  await chrome.storage.local.set({ snapshots });
}

export async function getLastState(): Promise<Stored["lastState"]> {
  return (await get("lastState")) ?? null;
}

export async function setLastState(state: HomepageState): Promise<void> {
  await chrome.storage.local.set({ lastState: { state, at: new Date().toISOString() } });
}

export async function getCoach(): Promise<CoachData> {
  return { ...EMPTY_COACH_DATA, ...(await get("coach")) };
}

export async function setCoach(coach: CoachData): Promise<void> {
  await chrome.storage.local.set({ coach });
}

export async function getAi(): Promise<AiSettings | null> {
  return (await get("ai")) ?? null;
}

export async function setAi(ai: AiSettings | null): Promise<void> {
  if (ai) await chrome.storage.local.set({ ai });
  else await chrome.storage.local.remove("ai");
}

export async function getUi(): Promise<UiPrefs> {
  return { ...DEFAULT_UI, ...(await get("ui")) };
}

export async function setUi(ui: UiPrefs): Promise<void> {
  await chrome.storage.local.set({ ui });
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.clear();
}

/** Calls `listener` whenever the coach data, snapshots or UI prefs change (in any tab or the popup). */
export function onDataChanged(listener: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.coach || changes.snapshots || changes.ui)) listener();
  });
}
