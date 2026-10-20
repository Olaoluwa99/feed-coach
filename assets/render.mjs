// Renders the icon PNGs and Chrome Web Store images with headless Chrome.
// Usage (from the feed-coach folder):  node assets/render.mjs [name-filter]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const assets = dirname(fileURLToPath(import.meta.url));
const root = resolve(assets, "..");
const src = join(assets, "store-src");

const icon = (size, out, extra = "") => ({ page: "icon.html", query: `?size=${size}${extra}`, w: size, h: size, out });

const jobs = [
  icon(16, "static/icons/icon-16.png"),
  icon(32, "static/icons/icon-32.png"),
  icon(48, "static/icons/icon-48.png"),
  icon(128, "static/icons/icon-128.png"),
  { page: "icon.html", query: "?size=96&pad=16&shadow=1", w: 128, h: 128, out: "store/icon-128.png" },
  { page: "screenshot-1-homepage.html", w: 1280, h: 800, out: "store/screenshot-1-homepage.png" },
  { page: "screenshot-2-goals.html", w: 1280, h: 800, out: "store/screenshot-2-goals.png" },
  { page: "screenshot-3-what-worked.html", w: 1280, h: 800, out: "store/screenshot-3-what-worked.png" },
  { page: "screenshot-4-private.html", w: 1280, h: 800, out: "store/screenshot-4-private.png" },
  { page: "promo-small.html", w: 440, h: 280, out: "store/promo-small-440x280.png" },
  { page: "promo-marquee.html", w: 1400, h: 560, out: "store/promo-marquee-1400x560.png" },
];

const filter = process.argv[2];
for (const job of jobs) {
  if (filter && !job.out.includes(filter)) continue;
  const out = join(root, job.out);
  const url = pathToFileURL(join(src, job.page)).href + (job.query ?? "");
  execFileSync(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    "--virtual-time-budget=2000",
    `--window-size=${job.w},${job.h}`,
    `--screenshot=${out}`,
    url,
  ], { stdio: "ignore" });
  const png = readFileSync(out);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  const ok = w === job.w && h === job.h;
  console.log(`${ok ? "ok " : "BAD"} ${job.out}  ${w}x${h}`);
  if (!ok) process.exitCode = 1;
}
