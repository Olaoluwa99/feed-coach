// Bundles the TypeScript entry points and copies static files into dist/.
// dist/ is what you load into Chrome with "Load unpacked".
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const watch = process.argv.includes("--watch");

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
cpSync("static", "dist", { recursive: true });

const shared = {
  outdir: "dist",
  bundle: true,
  target: "chrome120",
  sourcemap: true,
  logLevel: "info",
};

// Content scripts can't be ES modules, so they're bundled as classic scripts.
const builds = [
  { ...shared, entryPoints: { background: "src/background.ts", popup: "src/popup.ts", options: "src/options.ts" }, format: "esm" },
  { ...shared, entryPoints: { content: "src/content.ts" }, format: "iife" },
];

if (watch) {
  for (const options of builds) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
  }
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
