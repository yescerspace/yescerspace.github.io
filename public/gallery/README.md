# Gallery media (`public/gallery/`)

## Single source of truth

| What | Where |
|------|--------|
| **Which projects exist and in what order** | **`src/app/data/gallery-manifest.json`** — **edit manually**. Dev and build do **not** overwrite it. |
| **Media files on disk** | `public/gallery/...` — paths in the manifest must match real files (e.g. `gallery/3d-archive/FB/0.jpg`). |
| **Titles, descriptions, years (EN / DE / TR)** | **`src/app/i18n/translations.ts`** → `portfolioProjectsEn` / `De` / `Tr` → `portfolio.projects` |

There is **no** automatic scan of `public/gallery/` and **no** `gallery:sync` step. Add or change projects by editing **`gallery-manifest.json`**, then add matching **`categoryFolder/slug`** entries in all three language blocks in **`translations.ts`**. Put or rename files under **`public/gallery/`** so every path in `images[]` resolves.

## Manifest format

Each project has `category`, `categoryFolder`, `slug`, and `images[]` (paths relative to `public/`, usually `gallery/...`). The UI builds `projectKey` as `categoryFolder/slug` — it must match the translation keys.

## Layout (folder conventions)

Category folders typically used:

| App label (EN)     | Folder              |
|--------------------|---------------------|
| Interactive / VR   | `interactive-vr/`   |
| Motion             | `motion/`           |
| Campaigns          | `campaigns/`        |
| 3D Archive         | `3d-archive/`       |
| 2D Archive         | `2d-archive/`       |

Each **project** is a subfolder; file naming for the 3D card and detail view:

- **`0.*`** = gallery thumbnail + 3D card face (prefer a raster image for the card).
- **`1`**, **`2`**, … = detail order (numeric base names). Gaps are allowed (e.g. `0`, `1`, `3`).

## Placeholder JPEGs

To write tiny JPEGs for every **image** path listed in the manifest (does not change the manifest):

```bash
npm run gallery:placeholders
```

## Videos

Additional clips can live under **`public/videos/`** — see `public/videos/README.md`.
