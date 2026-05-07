import type { Quat as QuatT } from '../core/math/quat';

export type PersistField = 'face' | 'scroll' | 'rotation';

export interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

export interface PersistenceConfig {
  enabled?: boolean;
  storage?: 'localStorage' | 'sessionStorage' | StorageAdapter;
  key: string;
  persist?: readonly PersistField[];
  /** Debounce delay in ms before writing. Default 300. */
  debounce?: number;
  schemaVersion?: number;
  migrate?: (old: unknown, oldVersion: number) => PersistedState | null;
  onError?: (error: Error, op: 'read' | 'write' | 'parse') => void;
}

export interface PersistedState {
  v: number;
  face?: number;
  roll?: number;
  scroll?: Record<number, [number, number]>;
  rotation?: [number, number, number, number];
  ts: number;
}

class WebStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: Storage) {}
  get(key: string) { return this.storage.getItem(key); }
  set(key: string, value: string) { this.storage.setItem(key, value); }
  remove(key: string) { this.storage.removeItem(key); }
}

class MemoryStorageAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  get(key: string) { return this.map.get(key) ?? null; }
  set(key: string, value: string) { this.map.set(key, value); }
  remove(key: string) { this.map.delete(key); }
}

export function resolveStorage(config: PersistenceConfig): StorageAdapter {
  const storage = config.storage ?? 'localStorage';
  if (typeof storage === 'object') return storage;
  try {
    if (storage === 'localStorage' && typeof localStorage !== 'undefined') {
      return new WebStorageAdapter(localStorage);
    }
    if (storage === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
      return new WebStorageAdapter(sessionStorage);
    }
  } catch {
    // Storage is unavailable (Safari private mode, blocked cookies). Fall through.
  }
  return new MemoryStorageAdapter();
}

export class PersistenceManager {
  private adapter: StorageAdapter;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private debounceMs: number;
  private destroyed = false;
  private pendingState: PersistedState | null = null;

  constructor(private readonly config: PersistenceConfig) {
    this.adapter = resolveStorage(config);
    this.debounceMs = config.debounce ?? 300;
  }

  private fields(): Set<PersistField> {
    return new Set<PersistField>(this.config.persist ?? ['face', 'scroll']);
  }

  /**
   * Read the persisted state, applying migration if needed.
   * Returns null if storage is empty / invalid.
   */
  async load(): Promise<PersistedState | null> {
    if (!this.config.enabled) return null;
    let raw: string | null = null;
    try {
      raw = await Promise.resolve(this.adapter.get(this.config.key));
    } catch (e) {
      this.config.onError?.(e as Error, 'read');
      return null;
    }
    if (raw == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.config.onError?.(e as Error, 'parse');
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Partial<PersistedState>;
    const expectedVersion = this.config.schemaVersion ?? 1;
    if (obj.v !== expectedVersion && this.config.migrate) {
      try {
        const migrated = this.config.migrate(parsed, obj.v ?? 0);
        return migrated;
      } catch (e) {
        this.config.onError?.(e as Error, 'parse');
        return null;
      }
    }
    if (obj.v !== expectedVersion) return null;
    return obj as PersistedState;
  }

  /**
   * Schedule a write (debounced). Subsequent calls reset the timer.
   * The state is captured at flush time, not at scheduling time, so use update() to mutate.
   */
  scheduleWrite(state: PersistedState): void {
    if (this.destroyed || !this.config.enabled) return;
    this.pendingState = state;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    if (!this.pendingState) return;
    const fields = this.fields();
    const state: PersistedState = {
      v: this.config.schemaVersion ?? 1,
      ts: Date.now(),
    };
    if (fields.has('face')) {
      if (this.pendingState.face !== undefined) state.face = this.pendingState.face;
      if (this.pendingState.roll !== undefined) state.roll = this.pendingState.roll;
    }
    if (fields.has('scroll') && this.pendingState.scroll) state.scroll = this.pendingState.scroll;
    if (fields.has('rotation') && this.pendingState.rotation) state.rotation = this.pendingState.rotation;
    try {
      await Promise.resolve(this.adapter.set(this.config.key, JSON.stringify(state)));
    } catch (e) {
      this.config.onError?.(e as Error, 'write');
    }
  }

  async clear(): Promise<void> {
    try {
      await Promise.resolve(this.adapter.remove(this.config.key));
    } catch (e) {
      this.config.onError?.(e as Error, 'write');
    }
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.destroyed = true;
  }

  isEnabled(): boolean {
    return !!this.config.enabled;
  }
}

export function quatToTuple(q: QuatT): [number, number, number, number] {
  return [q[0], q[1], q[2], q[3]];
}
