#!/usr/bin/env node
/**
 * Reads src/app/data/gallery-manifest.json (manually maintained), then writes a minimal
 * valid JPEG into every image path listed there plus public/fallback.jpg.
 * Does not scan public/gallery or modify the manifest.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicRoot = path.join(root, "public");
const manifestPath = path.join(root, "src", "app", "data", "gallery-manifest.json");

/** Tiny 1×1 JPEG (shared placeholder until you replace files) */
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

if (!fs.existsSync(manifestPath)) {
  console.error("Missing src/app/data/gallery-manifest.json — create it or restore from git.");
  process.exit(1);
}

const VIDEO_RE = /\.(mp4|webm)$/i;

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let count = 0;
for (const project of manifest.projects) {
  for (const rel of project.images) {
    if (VIDEO_RE.test(rel)) continue;
    const dest = path.join(publicRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JPEG);
    count += 1;
  }
}

const fallback = path.join(publicRoot, "fallback.jpg");
fs.writeFileSync(fallback, JPEG);

console.log(`Wrote ${count} gallery placeholders + public/fallback.jpg`);
