# Gallery media (local assets)

The **3D gallery reads the folder tree** under `public/gallery/`. Adding a **new project subfolder** with at least one image under the correct **category folder** creates a new card after sync (automatic in dev/build, or run `npm run gallery:sync`).

Generated data lives in **`src/app/data/gallery-manifest.json`** (do not edit by hand — it is overwritten by the sync script). It lists **media paths only** (no titles or descriptions).

## Text content (titles, descriptions, years)

All portfolio **copy** for EN / DE / TR lives in **`src/app/i18n/translations.ts`**:

- Under **`portfolioProjectsEn`**, **`portfolioProjectsDe`**, and **`portfolioProjectsTr`** (merged into each locale as `portfolio.projects`).
- Each project is keyed by **`categoryFolder/slug`**, matching the folder path (e.g. `campaigns/Western Union`, `motion/Spotify Canvas Design`).

When you add a new project folder, run **`npm run gallery:sync`**, then add the same key and `{ title, description, year }` in **all three** language blocks in `translations.ts`. In development, the console warns if a manifest project is missing from English copy.

## Layout

Category folders (sync order; sidebar labels differ for some — see `WorksCategoryContext` / `translations.ts`):

| App label (EN)     | Folder              |
|--------------------|---------------------|
| Interactive / VR   | `interactive-vr/`   |
| Motion             | `motion/`           |
| Campaigns          | `campaigns/`        |
| 3D Archive         | `3d-archive/`       |
| 2D Archive         | `2d-archive/`       |

The `characters/` folder is **not** synced; remove or relocate those assets if you still need them.

Each **project** is a subfolder inside the category folder. Put **one or more** media files inside:

- Supported: **images** `.jpg`, `.jpeg`, `.png`, `.webp` and **videos** `.mp4`, `.webm`.
- **Names must be digits only** before the extension: **`0`** = gallery thumbnail + 3D card (must be a **raster** image for the card; not shown on the detail modal). **`1`**, **`2`**, **`3`**, … = detail page only, in numeric order (gaps like missing `2` are fine). Example: `0.jpg`, `1.mp4`, `3.png` shows `1` then `3` on the detail page.
- **Recommended hero size** for undistorted 3D cards: **1080×1080 px** (same aspect as the front/back faces in Gallery3D).
- Files without a numeric name sort **after** numbered files; you’ll get a warning if `0.*` is not first — prefer always having a `0.*` for each project.

## Adding a new card

1. Create `public/gallery/{category-folder}/{your-project-slug}/`.
2. Add media files (`0.*`, `1.*`, …).
3. Run sync (dev server or **`npm run gallery:sync`**).
4. Add **`category-folder/your-project-slug`** entries to **`portfolioProjectsEn`**, **`portfolioProjectsDe`**, and **`portfolioProjectsTr`** in **`translations.ts`**.

Empty project folders (no media) are **skipped** with a console warning.

## Placeholder JPEGs

After a clean clone or to fill every manifest path with tiny JPEGs:

```bash
npm run gallery:placeholders
```

(This runs sync first, then writes placeholders under `public/` and `public/fallback.jpg`.)

## Videos

Put video files under **`public/videos/`** (see `public/videos/README.md`) and reference them with `publicAsset("videos/...")` in components.
