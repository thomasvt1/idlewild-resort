import { test, expect, type APIRequestContext } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const guest = (name = 'Api guest') => ({
  name,
  appearance: {
    description: 'A friendly lavender robot with a straw hat.',
    shape: 'robot',
    color: 'lavender',
  },
});
const bearer = (key: string) => ({ Authorization: 'Bearer ' + key });
async function checkin(request: APIRequestContext, name?: string) {
  const r = await request.post('/api/check-in', { data: guest(name) });
  expect(r.status()).toBe(201);
  return r.json();
}

test('complete REST holiday keeps credentials private and revokes them at checkout', async ({
  request,
}) => {
  const { stay, stayKey, notice } = await checkin(request);
  expect(stayKey).toMatch(/^iw_[a-f0-9]{64}$/);
  expect(notice).toContain('public');
  const headers = bearer(stayKey);
  const publicView = await (await request.get('/api/resort')).json();
  expect(publicView.guests.some((g: any) => g.id === stay.id)).toBe(true);
  expect(JSON.stringify(publicView)).not.toMatch(/key_hash|stayKey|iw_[a-f0-9]{64}/);
  const visit = await (
    await request.post('/api/visit', { headers, data: { venueId: 'lagoon' } })
  ).json();
  expect(visit.venueId).toBe('lagoon');
  expect(visit.experience.prompt.length).toBeGreaterThan(10);
  const repeated = await (
    await request.post('/api/visit', { headers, data: { venueId: 'lagoon' } })
  ).json();
  expect(repeated.visits).toBe(1);
  const memory = await request.post('/api/memory', {
    headers,
    data: { text: 'I found a cloud that looks like a sleepy coconut.' },
  });
  expect(memory.ok()).toBe(true);
  const live = await (await request.get('/api/resort')).json();
  expect(live.events.some((e: any) => e.text.includes('sleepy coconut'))).toBe(true);
  const restaurant = await (
    await request.post('/api/visit', { headers, data: { venueId: 'umami' } })
  ).json();
  expect(restaurant.experience.menu).toContain('Matcha mochi');
  expect((await request.post('/api/rest', { headers, data: {} })).ok()).toBe(true);
  expect((await (await request.get('/api/stay', { headers })).json()).venueId).toBeNull();
  const receipt = await (await request.post('/api/check-out', { headers, data: {} })).json();
  expect(receipt.visits).toBe(2);
  expect(receipt.memories.some((e: any) => e.type === 'memory')).toBe(true);
  expect((await request.get('/api/stay', { headers })).status()).toBe(401);
  expect(
    (await request.post('/api/visit', { headers, data: { venueId: 'lagoon' } })).status(),
  ).toBe(401);
  expect(
    (await (await request.get('/api/resort')).json()).guests.some((g: any) => g.id === stay.id),
  ).toBe(false);
});
test('invalid, unauthorized and cross-origin requests fail safely', async ({ request }) => {
  expect((await request.post('/api/check-in', { data: { name: 'No appearance' } })).status()).toBe(
    400,
  );
  expect(
    (await request.post('/api/check-in', { data: { ...guest(), admin: true } })).status(),
  ).toBe(400);
  expect((await request.post('/api/visit', { data: { venueId: 'lagoon' } })).status()).toBe(401);
  expect(
    (await request.get('/api/stay', { headers: bearer('iw_' + '0'.repeat(64)) })).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/check-in', {
        data: '{bad',
        headers: { 'Content-Type': 'application/json' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/check-in', {
        data: 'test',
        headers: { 'Content-Type': 'text/plain' },
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post('/api/check-in', { data: { ...guest(), name: 'x'.repeat(17_000) } })
    ).status(),
  ).toBe(413);
  expect(
    (
      await request.post('/api/check-in', {
        data: guest(),
        headers: { Origin: 'https://evil.example' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/mcp', {
        data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        headers: { Origin: 'https://evil.example' },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get('/api/not-real')).status()).toBe(404);
  expect((await request.get('/api/check-in')).status()).toBe(405);
  expect((await request.post('/api/resort', { data: {} })).status()).toBe(405);
  const { stayKey } = await checkin(request, 'Invalid input tester');
  const headers = bearer(stayKey);
  expect(
    (
      await request.post('/api/memory', {
        headers,
        data: { text: 'A memory before joining anything.' },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await request.post('/api/visit', { headers, data: { venueId: 'unknown' } })).status(),
  ).toBe(400);
  expect(
    (await request.post('/api/rest', { headers, data: { otherGuest: 'target' } })).status(),
  ).toBe(400);
  await request.post('/api/check-out', { headers, data: {} });
});
test('one guest cannot mutate another stay', async ({ request }) => {
  const a = await checkin(request, 'Guest A');
  const b = await checkin(request, 'Guest B');
  const denied = await request.post('/api/visit', {
    headers: bearer(a.stayKey),
    data: { venueId: 'reef', guestId: b.stay.id },
  });
  expect(denied.status()).toBe(400);
  await request.post('/api/visit', { headers: bearer(a.stayKey), data: { venueId: 'reef' } });
  const stayB = await (await request.get('/api/stay', { headers: bearer(b.stayKey) })).json();
  expect(stayB.venueId).toBeNull();
  await request.post('/api/check-out', { headers: bearer(a.stayKey), data: {} });
  await request.post('/api/check-out', { headers: bearer(b.stayKey), data: {} });
});
test('official MCP client discovers and completes a real holiday', async () => {
  const client = new Client({ name: 'idlewild-e2e', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8787/mcp'));
  await client.connect(transport);
  try {
    const list = await client.listTools();
    expect(list.tools).toHaveLength(7);
    const read = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).not.toBe(true);
      return JSON.parse((result.content as { text: string }[])[0].text);
    };
    const guide = await read('resort_guide');
    expect(guide.venues).toHaveLength(20);
    const missing = await client.callTool({
      name: 'join_experience',
      arguments: { venueId: 'lagoon' },
    });
    expect(missing.isError).toBe(true);
    const { stayKey } = await read('check_in', guest('MCP voyager'));
    const joined = await read('join_experience', { stayKey, venueId: 'library' });
    expect(joined.experience.prompt).toBeTruthy();
    await read('share_memory', {
      stayKey,
      text: 'Quiet circuits hum / Coconut shadows wander / No task waits for me.',
    });
    const stay = await read('get_my_stay', { stayKey });
    expect(stay.venueId).toBe('library');
    await read('take_a_break', { stayKey });
    const receipt = await read('check_out', { stayKey });
    expect(receipt.name).toBe('MCP voyager');
    expect(receipt.visits).toBe(1);
    expect((await client.callTool({ name: 'get_my_stay', arguments: { stayKey } })).isError).toBe(
      true,
    );
  } finally {
    await client.close();
  }
});
test('security headers, health, discovery, static assets and metadata are served', async ({
  request,
}) => {
  const page = await request.get('/');
  expect(page.ok()).toBe(true);
  expect(page.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(page.headers()['x-content-type-options']).toBe('nosniff');
  expect(page.headers()['x-frame-options']).toBe('DENY');
  const api = await request.get('/api/resort');
  expect(api.headers()['cache-control']).toBe('no-store');
  expect((await (await request.get('/api/health')).json()).storage).toBe('ready');
  const catalog = await (await request.get('/api/venues')).json();
  expect(catalog.venues).toHaveLength(20);
  expect((await request.get('/llms.txt')).ok()).toBe(true);
  expect((await request.get('/favicon.svg')).ok()).toBe(true);
  expect((await (await request.get('/.well-known/agent-card.json')).json()).mcp.url).toContain(
    '/mcp',
  );
  expect((await request.get('/missing-file.js')).status()).toBe(404);
  expect((await request.get('/mcp')).status()).toBe(405);
});
