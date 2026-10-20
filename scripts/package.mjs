// Zips dist/ into release/feed-coach-<version>.zip for the Chrome Web Store and for testers.
// Run after `npm run build` (npm run package does both). No dependencies: a minimal zip
// writer using Node's built-in deflate and CRC-32.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const manifest = JSON.parse(readFileSync("dist/manifest.json", "utf8"));
const out = `release/feed-coach-${manifest.version}.zip`;

// Source maps aren't needed in the published extension.
const files = walk("dist").filter((file) => !file.endsWith(".map"));
for (const required of ["manifest.json", "icons/icon-128.png", "background.js", "content.js", "popup.html", "options.html"]) {
  if (!files.some((f) => toZipPath(f) === required)) throw new Error(`dist/${required} is missing. Did the build run?`);
}

const local = [];
const central = [];
let offset = 0;
for (const file of files.sort()) {
  const name = Buffer.from(toZipPath(file), "utf8");
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const { time, date } = dosDateTime(statSync(file).mtime);

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // local file header
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0x0800, 6); // UTF-8 names
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(packed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, packed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); // central directory header
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(time, 12);
  entry.writeUInt16LE(date, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += header.length + name.length + packed.length;
}

const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

mkdirSync("release", { recursive: true });
writeFileSync(out, Buffer.concat([...local, ...central, end]));
console.log(`Wrote ${out} (${files.length} files)`);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function toZipPath(file) {
  return relative("dist", file).split(sep).join("/");
}

function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}
