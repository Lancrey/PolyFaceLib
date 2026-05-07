/**
 * Minimal requestAnimationFrame loop driver. Lets the rest of the library
 * stay agnostic of the host (browser or jsdom).
 */

export type FrameCallback = (now: number) => void;

export class FrameLoop {
  private rafId: number | null = null;
  private running = false;
  private cb: FrameCallback | null = null;
  private alwaysRun = false;

  /**
   * @param alwaysRun If true, schedule frames continuously. If false (default),
   *                  the loop exposes a `wake()` method to schedule a single frame.
   */
  constructor(opts: { alwaysRun?: boolean } = {}) {
    this.alwaysRun = !!opts.alwaysRun;
  }

  setCallback(cb: FrameCallback): void {
    this.cb = cb;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.alwaysRun) this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Request a single frame (used in on-demand mode). */
  wake(): void {
    if (!this.running || this.rafId !== null) return;
    this.schedule();
  }

  private schedule(): void {
    this.rafId = requestFrame((now) => {
      this.rafId = null;
      if (!this.running) return;
      this.cb?.(now);
      if (this.alwaysRun && this.running) this.schedule();
    });
  }
}

function requestFrame(cb: (now: number) => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}
