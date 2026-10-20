// YouTube enforces Trusted Types: assigning HTML strings throws
// "This document requires 'TrustedHTML' assignment" and the extension's
// labels/panel silently disappear. Code that runs on youtube.com must build
// elements with createElement/textContent instead.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RUNS_ON_YOUTUBE = ["src/content.ts", "src/ui/overlay.ts", "src/youtube/homepage.ts", "src/youtube/feedback.ts"];
const FORBIDDEN = /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/;

describe("code that runs on youtube.com", () => {
  for (const file of RUNS_ON_YOUTUBE) {
    it(`${file} doesn't assign HTML strings`, () => {
      expect(readFileSync(file, "utf8")).not.toMatch(FORBIDDEN);
    });
  }
});
