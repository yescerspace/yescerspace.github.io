/** SPACE → ABOUT → CONNECT sırası (Mac touchpad space geçişi gibi). */
export const SHELL_NAV_PATHS = ["/", "/about", "/connect"] as const;

export function shellNavIndex(pathname: string): number {
  if (pathname === "/about") return 1;
  if (pathname === "/connect" || pathname === "/contact") return 2;
  return 0;
}

export function shellNavNeighbor(
  pathname: string,
  direction: "left" | "right",
): string | null {
  const idx = shellNavIndex(pathname);
  const next = direction === "right" ? idx + 1 : idx - 1;
  if (next < 0 || next >= SHELL_NAV_PATHS.length) return null;
  return SHELL_NAV_PATHS[next];
}

type PalmSample = { t: number; x: number; y: number };

const WINDOW_MS = 320;
const COOLDOWN_MS = 950;
const MIN_DX = 0.11;
const MIN_VELOCITY = 0.48;
const MIN_PEAK_STEP = 0.028;
const MAX_VERTICAL_RATIO = 0.62;

/** Hızlı yatay el sallama — sinek kovma / touchpad swipe. */
export class HandNavSwipeDetector {
  private history: PalmSample[] = [];
  private lastSwipeAt = 0;

  reset(): void {
    this.history = [];
    this.lastSwipeAt = 0;
  }

  push(
    now: number,
    palmX: number,
    palmY: number,
    eligible: boolean,
  ): "left" | "right" | null {
    if (!eligible) {
      this.history = [];
      return null;
    }

    this.history.push({ t: now, x: palmX, y: palmY });
    this.history = this.history.filter((s) => now - s.t <= WINDOW_MS);

    if (this.history.length < 5) return null;
    if (now - this.lastSwipeAt < COOLDOWN_MS) return null;

    const first = this.history[0]!;
    const last = this.history[this.history.length - 1]!;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const dt = Math.max(last.t - first.t, 1);

    if (Math.abs(dx) < MIN_DX) return null;
    if (Math.abs(dy) > Math.abs(dx) * MAX_VERTICAL_RATIO) return null;
    if (Math.abs(dx) / (dt / 1000) < MIN_VELOCITY) return null;

    const sign = Math.sign(dx);
    let peakStep = 0;
    let sameSign = 0;
    for (let i = 1; i < this.history.length; i += 1) {
      const step = this.history[i]!.x - this.history[i - 1]!.x;
      peakStep = Math.max(peakStep, Math.abs(step));
      if (Math.sign(step) === sign || Math.abs(step) < 0.004) sameSign += 1;
    }
    const steps = this.history.length - 1;
    if (peakStep < MIN_PEAK_STEP) return null;
    if (sameSign / steps < 0.65) return null;

    this.lastSwipeAt = now;
    this.history = [];
    return sign > 0 ? "right" : "left";
  }
}
