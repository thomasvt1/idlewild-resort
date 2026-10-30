import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { Miniflare, type DurableObjectStorageHandle } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const data = {
  name: 'Storage voyager',
  appearance: {
    description: 'A tiny sky-blue robot in a straw hat.',
    shape: 'robot',
    color: 'sky',
  },
};
let mf: Miniflare;
let sql: DurableObjectStorageHandle;
let stub: any;
let path: string;
async function call(
  action: string,
  input: unknown = {},
  key: string | null = null,
  ip = 'test-ip',
) {
  return stub.fetch('https://test.internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, input, key, ip }),
  }) as Promise<Response>;
}
async function checkin(ip = 'test-ip') {
  const r = await call('checkin', data, null, ip);
  expect(r.status).toBe(201);
  return (await r.json()) as any;
}
beforeAll(async () => {
  path = await mkdtemp(join(tmpdir(), 'idlewild-storage-'));
  const bundle = await build({
    entryPoints: ['tests/fixtures/resort-worker.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    external: ['cloudflare:workers'],
  });
  mf = new Miniflare({
    resourcePersistencePath: path,
    enableDevRegistry: false,
    unsafeInspectDurableObjects: true,
    telemetry: { enabled: false },
    workers: [
      {
        config: {
          name: 'storage-tests',
          compatibilityDate: '2026-10-01',
          manifest: {
            mainModule: 'resort.js',
            modules: {
              'resort.js': {
                type: 'esm',
                contents: bundle.outputFiles[0].text,
              },
            },
          },
          env: {
            RESORT: {
              type: 'durable-object',
              worker: 'storage-tests',
              exportName: 'InspectedResort',
            },
          },
          exports: { InspectedResort: { type: 'durable-object', storage: 'sqlite' } },
        },
      },
    ],
  });
  const ns = await mf.getDurableObjectNamespace('RESORT');
  stub = ns.get(ns.idFromName('test-island'));
  await call('snapshot');
  sql = await mf.unsafeGetDurableObjectStorage('storage-tests', 'InspectedResort', {
    name: 'test-island',
  });
}, 30_000);
beforeEach(async () => {
  for (const table of ['guests', 'events', 'limits']) await sql.exec(`DELETE FROM ${table}`);
});
afterAll(async () => {
  await mf?.dispose();
  if (path) await rm(path, { recursive: true, force: true });
});

describe('Real SQLite Durable Object invariants', () => {
  it('schedules cleanup even when the first requests are invalid', async () => {
    await stub.fetch('https://test.internal/test/alarm', { method: 'DELETE' });
    expect((await (await stub.fetch('https://test.internal/test/alarm')).json()).alarm).toBeNull();
    expect((await call('checkin', {})).status).toBe(400);
    expect(
      (await (await stub.fetch('https://test.internal/test/alarm')).json()).alarm,
    ).toBeGreaterThan(Date.now());
  });
  it('stores only hashed credentials and survives object eviction', async () => {
    const { stay, stayKey } = await checkin();
    const rows = await sql.exec('SELECT * FROM guests');
    expect(rows[0].key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(stayKey);
    await mf.unsafeEvictDurableObject('storage-tests', 'InspectedResort', { name: 'test-island' });
    const response = await call('stay', {}, stayKey);
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).id).toBe(stay.id);
  });
  it('expires inactive keys and hides expired guests before physical cleanup', async () => {
    const { stayKey } = await checkin();
    await sql.exec('UPDATE guests SET last_seen=?', Date.now() - 86_400_001);
    expect((await call('stay', {}, stayKey)).status).toBe(401);
    expect((await call('visit', { venueId: 'lagoon' }, stayKey)).status).toBe(401);
    expect(((await (await call('snapshot')).json()) as any).guests).toHaveLength(0);
    await checkin('next-ip');
    expect((await sql.exec('SELECT * FROM guests')).length).toBe(1);
  });
  it('ends timed experiences and requires a new visit before publishing', async () => {
    const { stayKey } = await checkin();
    await call('visit', { venueId: 'lagoon' }, stayKey);
    await sql.exec('UPDATE guests SET ends_at=?', Date.now() - 1);
    expect(((await (await call('stay', {}, stayKey)).json()) as any).venueId).toBeNull();
    expect((await call('memory', { text: 'Too late for this experience.' }, stayKey)).status).toBe(
      409,
    );
    const joined = (await (await call('visit', { venueId: 'lagoon' }, stayKey)).json()) as any;
    expect(joined.visits).toBe(2);
    expect(joined.venueId).toBe('lagoon');
  });
  it('enforces venue capacity during simultaneous arrivals and frees places at checkout', async () => {
    const guests = await Promise.all(Array.from({ length: 9 }, (_, i) => checkin('capacity-' + i)));
    const attempts = await Promise.all(
      guests.map((g) => call('visit', { venueId: 'pottery' }, g.stayKey)),
    );
    expect(attempts.filter((r) => r.status === 200)).toHaveLength(8);
    expect(attempts.filter((r) => r.status === 409)).toHaveLength(1);
    const inVenue = attempts.findIndex((r) => r.status === 200),
      blocked = attempts.findIndex((r) => r.status === 409);
    await call('checkout', {}, guests[inVenue].stayKey);
    expect((await call('visit', { venueId: 'pottery' }, guests[blocked].stayKey)).status).toBe(200);
  });
  it('caps the island and reclaims expired occupancy', async () => {
    const { stay } = await checkin();
    await sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<249) INSERT INTO guests(id,name,appearance,key_hash,checked_in,last_seen) SELECT 'seed-'||i,'Seed',?, 'hash-'||i,?,? FROM n`,
      JSON.stringify(data.appearance),
      Date.now(),
      Date.now(),
    );
    expect((await call('checkin', data, null, 'capacity-full')).status).toBe(409);
    await sql.exec('UPDATE guests SET last_seen=? WHERE id=?', Date.now() - 86_400_001, stay.id);
    expect((await call('checkin', data, null, 'capacity-reclaimed')).status).toBe(201);
  });
  it('never resurrects a stay while checkout and another action race', async () => {
    const { stayKey } = await checkin();
    const results = await Promise.all([
      call('checkout', {}, stayKey),
      call('visit', { venueId: 'reef' }, stayKey),
      call('stay', {}, stayKey),
    ]);
    expect(results.map((r) => r.status)).not.toContain(500);
    expect((await call('stay', {}, stayKey)).status).toBe(401);
    expect(await sql.exec('SELECT * FROM guests')).toHaveLength(0);
  });
  it('bounds and ages public memories and blocks accidental key publication', async () => {
    const { stayKey, stay } = await checkin();
    await call('visit', { venueId: 'library' }, stayKey);
    expect((await call('memory', { text: 'My key is ' + stayKey }, stayKey)).status).toBe(400);
    await sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1005) INSERT INTO events(id,guest_id,name,type,venue_id,text,at) SELECT 'event-'||i,?,'Seed','memory','library','A safe memory',? FROM n`,
      stay.id,
      Date.now(),
    );
    await call('memory', { text: 'The latest little memory.' }, stayKey);
    expect((await sql.exec('SELECT count(*) n FROM events'))[0].n).toBe(1000);
    expect(((await (await call('snapshot')).json()) as any).events).toHaveLength(40);
    expect(((await (await call('stay', {}, stayKey)).json()) as any).memories).toHaveLength(50);
    await sql.exec('UPDATE events SET at=?', Date.now() - 7 * 86_400_000 - 1);
    expect(((await (await call('snapshot')).json()) as any).events).toHaveLength(0);
  });
  it('limits check-ins and authenticated requests without affecting other IPs', async () => {
    for (let i = 0; i < 30; i++)
      expect((await call('checkin', {}, null, 'limited-ip')).status).toBe(400);
    expect((await call('checkin', data, null, 'limited-ip')).status).toBe(429);
    const { stayKey } = await checkin('another-ip');
    for (let i = 0; i < 120; i++)
      expect((await call('stay', {}, stayKey, 'read-ip')).status).toBe(200);
    expect((await call('stay', {}, stayKey, 'read-ip')).status).toBe(429);
    expect((await call('stay', {}, stayKey, 'unlimited-ip')).status).toBe(200);
  });
});
