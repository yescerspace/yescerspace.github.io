/** Primary public origin — canonical URLs always use this, including on github.io. */
export const SITE_CANONICAL_ORIGIN = "https://yesimceren.com";

export function canonicalUrlForPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/contact") return `${SITE_CANONICAL_ORIGIN}/connect`;
  if (normalized === "/") return SITE_CANONICAL_ORIGIN;
  return `${SITE_CANONICAL_ORIGIN}${normalized}`;
}

export function syncDocumentCanonical(pathname: string): void {
  if (typeof document === "undefined") return;
  const href = canonicalUrlForPath(pathname);
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}
