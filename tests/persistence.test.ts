import { describe, it, expect, beforeEach } from 'vitest';
import { PersistenceManager } from '../src/persistence/persistence';
import type { StorageAdapter } from '../src/persistence/persistence';

class TestAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  get(k: string) { return this.map.get(k) ?? null; }
  set(k: string, v: string) { this.map.set(k, v); }
  remove(k: string) { this.map.delete(k); }
  size() { return this.map.size; }
  raw(k: string) { return this.map.get(k); }
}

describe('PersistenceManager', () => {
  let adapter: TestAdapter;
  beforeEach(() => { adapter = new TestAdapter(); });

  it('writes and reads state', async () => {
    const pm = new PersistenceManager({
      enabled: true,
      key: 'test',
      storage: adapter,
      schemaVersion: 1,
      debounce: 0,
    });
    pm.scheduleWrite({ v: 1, face: 2, roll: 1, scroll: { 0: [10, 20] }, ts: 1 });
    await new Promise(r => setTimeout(r, 5));
    const loaded = await pm.load();
    expect(loaded?.face).toBe(2);
    expect(loaded?.roll).toBe(1);
    expect(loaded?.scroll?.[0]).toEqual([10, 20]);
  });

  it('honors `persist` field selection', async () => {
    const pm = new PersistenceManager({
      enabled: true,
      key: 'test',
      storage: adapter,
      schemaVersion: 1,
      debounce: 0,
      persist: ['face'],
    });
    pm.scheduleWrite({ v: 1, face: 1, roll: 0, scroll: { 0: [10, 20] }, ts: 1 });
    await new Promise(r => setTimeout(r, 5));
    const loaded = await pm.load();
    expect(loaded?.face).toBe(1);
    expect(loaded?.scroll).toBeUndefined();
  });

  it('migrates incompatible schema', async () => {
    adapter.set('test', JSON.stringify({ v: 0, foo: 'bar', ts: 0 }));
    const pm = new PersistenceManager({
      enabled: true,
      key: 'test',
      storage: adapter,
      schemaVersion: 2,
      migrate: () => ({ v: 2, face: 5, ts: 99 }),
    });
    const loaded = await pm.load();
    expect(loaded?.face).toBe(5);
    expect(loaded?.v).toBe(2);
  });

  it('returns null for malformed data without throwing', async () => {
    adapter.set('test', '{not valid json');
    let captured: { error: Error; op: string } | null = null;
    const pm = new PersistenceManager({
      enabled: true,
      key: 'test',
      storage: adapter,
      schemaVersion: 1,
      onError: (error, op) => { captured = { error, op }; },
    });
    const loaded = await pm.load();
    expect(loaded).toBeNull();
    expect(captured).not.toBeNull();
  });
});
