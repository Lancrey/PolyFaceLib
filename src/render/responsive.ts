export type SizingMode = 'fit' | 'fill' | number;

export interface BreakpointsConfig {
  mobile: number;     // < mobile width is mobile
  tablet: number;     // < tablet width is tablet (and >= mobile)
}

export const DEFAULT_BREAKPOINTS: BreakpointsConfig = {
  mobile: 640,
  tablet: 1024,
};

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export function classify(width: number, bp: BreakpointsConfig = DEFAULT_BREAKPOINTS): Breakpoint {
  if (width < bp.mobile) return 'mobile';
  if (width < bp.tablet) return 'tablet';
  return 'desktop';
}

export interface ContainerObserver {
  width: number;
  height: number;
  size: number;
  breakpoint: Breakpoint;
}

/**
 * Resolve the polyhedron size in pixels based on the container dimensions and the user's sizing preference.
 */
export function computeSize(width: number, height: number, sizing: SizingMode): number {
  if (typeof sizing === 'number') return sizing;
  if (sizing === 'fill') return Math.max(width, height);
  return Math.min(width, height);
}

/**
 * Wrap a ResizeObserver in a small abstraction. Falls back to window resize when ResizeObserver
 * is unavailable (older test runners).
 */
export class StageResizeObserver {
  private ro: ResizeObserver | null = null;
  private fallback: (() => void) | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly cb: (width: number, height: number) => void,
  ) {}

  start(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(entries => {
        for (const e of entries) {
          const cr = e.contentRect;
          this.cb(cr.width, cr.height);
        }
      });
      this.ro.observe(this.el);
    } else {
      const handler = () => {
        const r = this.el.getBoundingClientRect();
        this.cb(r.width, r.height);
      };
      this.fallback = handler;
      window.addEventListener('resize', handler);
      handler();
    }
  }

  stop(): void {
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    if (this.fallback) {
      window.removeEventListener('resize', this.fallback);
      this.fallback = null;
    }
  }
}
