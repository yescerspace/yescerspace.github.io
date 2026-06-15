/**
 * Resolves paths to files in `/public` (copied to `dist/` as-is by Vite).
 * Result is `import.meta.env.BASE_URL` + path segment — e.g. `gallery/...` →
 * `/base/gallery/...` in production. Do not use a separate root-level `gallery/`
 * folder; keep assets only under `public/gallery/`.
 */
export function publicAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    const m = path.match(/\/public\/(gallery\/[^/?#]+)/i);
    if (m) return publicAsset(m[1]!);
    return path;
  }
  const p = path.startsWith("/") ? path.slice(1) : path;
  const base = import.meta.env.BASE_URL;
  if (!base || base === "/") return `/${p}`;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${b}/${p}`;
}
