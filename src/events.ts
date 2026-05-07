export type EventMap = {
  beforeNavigate: { from: number; to: number; edgeIndex?: number; preventDefault: () => void };
  afterNavigate: { from: number; to: number };
  faceClick: { face: number; position: { x: number; y: number } };
  faceScroll: { face: number; x: number; y: number };
  resize: { width: number; height: number; size: number };
  animationFrame: { progress: number };
};

export type EventName = keyof EventMap;

export type Listener<E extends EventName> = (e: EventMap[E]) => void;

export class Emitter {
  private listeners: { [E in EventName]?: Set<Listener<E>> } = {};

  on<E extends EventName>(name: E, fn: Listener<E>): () => void {
    let set = this.listeners[name] as Set<Listener<E>> | undefined;
    if (!set) {
      set = new Set<Listener<E>>();
      (this.listeners[name] as Set<Listener<E>>) = set;
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  off<E extends EventName>(name: E, fn: Listener<E>): void {
    const set = this.listeners[name] as Set<Listener<E>> | undefined;
    set?.delete(fn);
  }

  emit<E extends EventName>(name: E, payload: EventMap[E]): void {
    const set = this.listeners[name] as Set<Listener<E>> | undefined;
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[polyfacelib] listener error for ${name}:`, err); }
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
