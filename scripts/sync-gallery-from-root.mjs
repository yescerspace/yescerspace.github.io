/**
 * `gallery/` (kök) ve `public/gallery/` arasında güvenli eşleme — Vite `public/` sunar.
 *
 * `categoryFolder === "work"` → disk yolu `gallery/<slug>/` (tek seviye; slug = 1, 2, …).
 * Diğer kategoriler: `gallery/<categoryFolder>/<slug>/`.
 *
 * ÖNEMLİ:
 * - **Hiçbir medya dosyası silinmez.**
 * - `--` / `--*` slug (work) = taslak; manifest’te yoksa uyarı yok.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "src/app/data/gallery-manifest.json");

/** Flat numaralı projeler — `projectKey` = `work/<slug>`, klasör = `gallery/<slug>/` */
const FLAT_WORK_FOLDER = "work";

function isDraftSlugHidden(slug) {
  const s = String(slug).trim();
  return s === "--" || s.startsWith("--");
}

function galleryRelFromProj(proj) {
  if (proj.categoryFolder === FLAT_WORK_FOLDER) {
    return path.join("gallery", String(proj.slug));
  }
  return path.join("gallery", proj.categoryFolder, proj.slug);
}

function listFiles(absDir) {
  if (!fs.existsSync(absDir)) return [];
  return fs.readdirSync(absDir).filter((f) => {
    if (f.startsWith(".") || f === "README.md" || f === ".DS_Store") return false;
    return fs.statSync(path.join(absDir, f)).isFile();
  });
}

function naturalSort(files) {
  const c = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  return [...files].sort(c.compare);
}

/** `1.mp4` yanında `1-.jpg` — manifest slaytı değil; yalnızca video poster (UI türetir). */
function isVideoPosterCompanionFilename(name) {
  return /^\d+-\.(jpe?g|png|webp)$/i.test(String(name));
}

/** Kaynak / ara encode — slayt değil. */
function isGalleryAuxMediaFilename(name) {
  const n = String(name);
  return (
    n.endsWith("-source.mp4") ||
    n.endsWith(".web.tmp.mp4") ||
    n.endsWith(".web.mp4")
  );
}

function hashFile(p) {
  const h = crypto.createHash("md5");
  h.update(fs.readFileSync(p));
  return h.digest("hex");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const actions = [];

for (const proj of manifest.projects) {
  const rel = galleryRelFromProj(proj);
  const srcDir = path.join(root, rel);
  const dstDir = path.join(root, "public", rel);

  const rootExists = fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory();
  const pubExists = fs.existsSync(dstDir) && fs.statSync(dstDir).isDirectory();

  if (!rootExists && !pubExists) {
    console.error("Eksik klasör (kök ve public yok):", rel);
    process.exitCode = 1;
    continue;
  }

  if (!rootExists && pubExists) {
    fs.mkdirSync(srcDir, { recursive: true });
    for (const f of listFiles(dstDir)) {
      fs.copyFileSync(path.join(dstDir, f), path.join(srcDir, f));
      actions.push(`kök gallery oluşturuldu ← public: ${rel}/${f}`);
    }
  }

  if (rootExists && !pubExists) {
    fs.mkdirSync(dstDir, { recursive: true });
    for (const f of listFiles(srcDir)) {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      actions.push(`public ← kök (klasör yeni): ${rel}/${f}`);
    }
  }

  const names = new Set([...listFiles(srcDir), ...listFiles(dstDir)]);

  for (const f of names) {
    const rPath = path.join(srcDir, f);
    const pPath = path.join(dstDir, f);
    const rOk = fs.existsSync(rPath);
    const pOk = fs.existsSync(pPath);

    if (rOk && !pOk) {
      fs.mkdirSync(dstDir, { recursive: true });
      fs.copyFileSync(rPath, pPath);
      actions.push(`public ← kök: ${rel}/${f}`);
      continue;
    }
    if (pOk && !rOk) {
      fs.mkdirSync(srcDir, { recursive: true });
      fs.copyFileSync(pPath, rPath);
      actions.push(`kök gallery ← public: ${rel}/${f}`);
      continue;
    }

    if (hashFile(rPath) === hashFile(pPath)) continue;

    const tr = fs.statSync(rPath).mtimeMs;
    const tp = fs.statSync(pPath).mtimeMs;
    const skewMs = 500;

    if (tr > tp + skewMs) {
      fs.copyFileSync(rPath, pPath);
      actions.push(`public ← kök (daha yeni): ${rel}/${f}`);
    } else if (tp > tr + skewMs) {
      fs.copyFileSync(pPath, rPath);
      actions.push(`kök ← public (daha yeni): ${rel}/${f}`);
    } else {
      fs.copyFileSync(pPath, rPath);
      actions.push(`kök ← public (eşit tarih, içerik farkı → public): ${rel}/${f}`);
    }
  }

  const finalList = naturalSort(
    [...new Set([...listFiles(srcDir), ...listFiles(dstDir)])],
  ).filter(
    (f) => !isVideoPosterCompanionFilename(f) && !isGalleryAuxMediaFilename(f),
  );
  const prefix = `${rel.replace(/\\/g, "/")}/`;
  proj.images = finalList.map((file) => `${prefix}${file}`.replace(/\\/g, "/"));
}

manifest.lastUpdated = new Date().toISOString();
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (actions.length) {
  console.log(actions.join("\n"));
} else {
  console.log("Kök ve public gallery zaten aynı içerik (özet).");
}
console.log("gallery-manifest.json güncellendi:", manifest.lastUpdated);

const galleryRoot = path.join(root, "gallery");
const knownProjects = new Set(
  manifest.projects.map((p) => `${p.categoryFolder}/${p.slug}`),
);
const flatNumRe = /^\d+$/;

if (fs.existsSync(galleryRoot)) {
  for (const name of fs.readdirSync(galleryRoot)) {
    if (name.startsWith(".") || name === "README.md") continue;
    const p = path.join(galleryRoot, name);
    if (!fs.statSync(p).isDirectory()) continue;

    if (flatNumRe.test(name)) {
      const key = `${FLAT_WORK_FOLDER}/${name}`;
      if (!knownProjects.has(key)) {
        console.warn(
          `[gallery:sync] "${key}" manifest’te yok → sitede görünmez; gallery-manifest.json’a work satırı ekleyin.`,
        );
      }
      continue;
    }

    if (isDraftSlugHidden(name)) continue;

    console.warn(
      `[gallery:sync] Beklenmeyen gallery alt klasörü (flat yapıda sadece 1…N veya taslak "--"): ${name}`,
    );
  }
}
