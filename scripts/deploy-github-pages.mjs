#!/usr/bin/env node
/**
 * GitHub Pages deploy helper (yescerspace.github.io → yesimceren.com).
 * Build → stage index.html, 404.html, hashed bundle from index.html, src/ changes.
 *
 * Usage:
 *   node scripts/deploy-github-pages.mjs "Deploy message"
 *   node scripts/deploy-github-pages.mjs "Deploy message" --push
 *   npm run deploy -- "Deploy message"
 *   npm run deploy:push -- "Deploy message"
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cliArgs = process.argv.slice(2);
const push = cliArgs.includes("--push");
const message = cliArgs.filter((a) => a !== "--push").join(" ").trim();

if (!message?.trim()) {
  console.error(
    "Usage: npm run deploy -- \"Commit message\" [--push via deploy:push]",
  );
  process.exit(1);
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: "inherit", ...opts });
}

function assetPathsFromIndexHtml() {
  const html = readFileSync(resolve(root, "index.html"), "utf8");
  const paths = new Set();
  for (const m of html.matchAll(/\/(assets\/[^"'\s]+)/g)) {
    paths.add(m[1]);
  }
  return [...paths];
}

/** Vite also emits hashed files only referenced from the JS chunk (e.g. halo PNG). */
function assetPathsFromBuiltJs(htmlAssetPaths) {
  const paths = new Set(htmlAssetPaths);
  for (const rel of htmlAssetPaths) {
    if (!rel.endsWith(".js")) continue;
    const abs = resolve(root, rel);
    if (!existsSync(abs)) continue;
    const js = readFileSync(abs, "utf8");
    for (const m of js.matchAll(/\/(assets\/[^"'\s]+)/g)) {
      paths.add(m[1]);
    }
  }
  return [...paths];
}

console.log("→ npm run build");
run("npm run build");

const assets = assetPathsFromBuiltJs(assetPathsFromIndexHtml());
const toAdd = ["index.html", "404.html", ".nojekyll", ...assets];
for (const rel of toAdd) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    console.error(`Missing after build: ${rel}`);
    process.exit(1);
  }
}

console.log("→ git add gallery media from manifest");
const manifestPath = resolve(root, "src/app/data/gallery-manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const galleryFiles = new Set();
  for (const proj of manifest.projects ?? []) {
    for (const img of proj.images ?? []) {
      if (typeof img !== "string" || !img.startsWith("gallery/")) continue;
      galleryFiles.add(img);
      if (/\.mp4$/i.test(img)) {
        galleryFiles.add(img.replace(/\.mp4$/i, "-.jpg"));
      }
      // 3D kart dokusu: küçük WebP kapak (manifest'te değil, ayrıca staging'e ekle).
      if (/\/00\.(jpe?g|png|webp)$/i.test(img)) {
        galleryFiles.add(img.replace(/\/00\.[^/.]+$/i, "/00-thumb.webp"));
      }
    }
  }
  for (const rel of galleryFiles) {
    for (const p of [rel, join("public", rel)]) {
      if (existsSync(resolve(root, p))) {
        run(`git add ${JSON.stringify(p)}`);
      }
    }
  }
}

console.log("→ git add (src + deploy artifacts)");
run("git add src/");
run(`git add ${toAdd.map((p) => JSON.stringify(p)).join(" ")}`);
if (existsSync(resolve(root, "index.template.html"))) {
  run("git add index.template.html");
}
if (existsSync(resolve(root, "package.json"))) {
  run("git add package.json");
}
const deployScript = resolve(root, "scripts/deploy-github-pages.mjs");
if (existsSync(deployScript)) {
  run(`git add ${JSON.stringify("scripts/deploy-github-pages.mjs")}`);
}
if (existsSync(resolve(root, "gallery-halo-grey-ring.png"))) {
  run("git add gallery-halo-grey-ring.png");
}
if (existsSync(resolve(root, "fonts"))) {
  run("git add fonts/");
}
if (existsSync(resolve(root, "public/fonts"))) {
  run("git add public/fonts/");
}

const status = execSync("git status --porcelain", {
  cwd: root,
  encoding: "utf8",
}).trim();
if (!status) {
  console.log("Nothing to commit (working tree clean after build).");
  process.exit(0);
}

console.log("→ git commit");
run(`git commit -m ${JSON.stringify(message.trim())}`);

if (push) {
  console.log("→ git push origin main");
  run("git push origin main");
} else {
  console.log("Committed locally. Push with: npm run deploy:push -- \"…\"");
}
