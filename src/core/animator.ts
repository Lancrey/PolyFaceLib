import { Quat } from './math/quat';
import type { Quat as QuatT } from './math/quat';

export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInQuad: (t: number) => t * t,
};

export interface AnimationOptions {
  duration: number;
  easing?: EasingFn;
}

export interface QuatAnimationState {
  from: QuatT;
  to: QuatT;
  startTime: number;
  duration: number;
  easing: EasingFn;
  done: boolean;
  /** Set to true if animation is suppressed (reduced motion). */
  instant?: boolean;
}

export function startQuatAnimation(
  from: QuatT,
  to: QuatT,
  opts: AnimationOptions,
  now = performance.now(),
): QuatAnimationState {
  return {
    from,
    to,
    startTime: now,
    duration: Math.max(0, opts.duration),
    easing: opts.easing ?? Easing.easeInOutCubic,
    done: false,
  };
}

/**
 * Step the animation: returns the current quaternion and updates `state.done`.
 */
export function stepQuatAnimation(state: QuatAnimationState, now: number): QuatT {
  if (state.done) return state.to;
  if (state.instant || state.duration <= 0) {
    state.done = true;
    return state.to;
  }
  const t = Math.max(0, Math.min(1, (now - state.startTime) / state.duration));
  const eased = state.easing(t);
  if (t >= 1) {
    state.done = true;
    return state.to;
  }
  return Quat.slerp(state.from, state.to, eased);
}

export function animationProgress(state: QuatAnimationState, now: number): number {
  if (state.done) return 1;
  if (state.instant || state.duration <= 0) return 1;
  return Math.max(0, Math.min(1, (now - state.startTime) / state.duration));
}
