# Media documentation

## Local assets

- **Gallery images**: `public/gallery/` — paths referenced from **`src/app/data/gallery-manifest.json`** (manually edited; not auto-generated). See [`public/gallery/README.md`](../public/gallery/README.md). Per project, name files **`0.*`** (hero + cover), **`1.*`**, **`2.*`**, … as needed.
- **Gallery index**: **`src/app/data/gallery-manifest.json`** — **manual source of truth** for project list and `images[]`. Nothing in `npm run dev` / `npm run build` rewrites it.
- **Runtime code**: `src/app/data/galleryData.ts` imports the manifest and wraps paths with **`publicAsset()`** from **`src/app/utils/publicAsset.ts`** so URLs respect Vite `base`.
- **Portfolio titles, descriptions, years (EN / DE / TR)**: **`src/app/i18n/translations.ts`** — `portfolioProjectsEn` / `portfolioProjectsDe` / `portfolioProjectsTr`, keyed by `categoryFolder/slug` (see `portfolioProjectCopy()` in the same file).
- **Videos** (when you add them): `public/videos/` — see [`public/videos/README.md`](../public/videos/README.md).
- **Global image fallback** (load errors): `public/fallback.jpg`.

## After clone or placeholder fill

```bash
npm run gallery:placeholders
```

Reads the current **`gallery-manifest.json`** and writes tiny JPEGs for each listed image path (plus `public/fallback.jpg`). Does not modify the manifest.

## Categories

Folder names under `public/gallery/` should match what you declare in **`gallery-manifest.json`** (`categoryFolder` / `slug`). Nav category order is defined in `WorksCategoryContext` / `translations.ts`.
