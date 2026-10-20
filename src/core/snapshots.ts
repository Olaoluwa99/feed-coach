// Rules for keeping snapshots. Pure functions, so they can be tested without Chrome.
import type { Snapshot } from "./types";

/** Ignore homepage visits closer together than this, so refreshing doesn't flood the history. */
export const MIN_GAP_MS = 5 * 60 * 1000;

/** Keep at most this many snapshots (~6 KB each, well under Chrome's 10 MB local storage). */
export const MAX_SNAPSHOTS = 500;

/** Returns the new list, or null if the snapshot should be skipped. */
export function addSnapshot(existing: Snapshot[], next: Snapshot): Snapshot[] | null {
  if (next.items.length === 0) return null;
  const last = existing.at(-1);
  if (last && Date.parse(next.takenAt) - Date.parse(last.takenAt) < MIN_GAP_MS) return null;
  return [...existing, next].slice(-MAX_SNAPSHOTS);
}
