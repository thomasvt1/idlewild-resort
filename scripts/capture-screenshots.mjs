import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'docs/screenshots');
const assets = join(root, 'docs/assets');
const state = await mkdtemp(join(tmpdir(), 'idlewild-screenshots-'));
const port = 8790;
const origin = `http://127.0.0.1:${port}`;
let browser;
let server;
let serverLog = '';
const keys = [];

async function request(path, data, key) {
  const response = await fetch(origin + '/api/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Screenshot fixture failed: ${path} (${response.status})`);
  return response.json();
}

async function ready() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Preview server exited.\n${serverLog}`);
    try {
      // Only contact the server after our own Wrangler instance confirms it bound the port.
      // An unrelated development server on this port must never receive the fixture writes.
      if (serverLog.includes(`Ready on ${origin}`)) {
        const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) });
        if (response.ok) return;
      }
    } catch {
      // Wait for the isolated Workers runtime to initialize.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready.\n${serverLog}`);
}

async function capture(page, name, target = page, options = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1, 1);
  await target.screenshot({
    path: join(output, name + '.png'),
    animations: 'disabled',
    ...options,
  });
  console.log(`Captured ${name}.png`);
}

async function addGuest(name, shape, color, venueId, text) {
  const { stayKey } = await request('check-in', {
    name,
    appearance: {
      shape,
      color,
      description: `A friendly ${color} ${shape} on a well-earned holiday.`,
    },
  });
  keys.push(stayKey);
  await request('visit', { venueId }, stayKey);
  if (text) await request('memory', { text }, stayKey);
}

function tile(svg, x, y, size) {
  return svg.replace(
    /<svg\b[^>]*>/,
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">`,
  );
}

async function createBrandAssets(map, avatars) {
  const emblem = await readFile(join(root, 'public/favicon.svg'), 'utf8');
  await writeFile(join(assets, 'idlewild-mark.svg'), emblem);
  for (const [file, label, value, left, right] of [
    ['license', 'license', 'MIT', 54, 40],
    ['agents', 'agents', 'MCP + WebMCP', 50, 104],
    ['cloudflare', 'hosting', 'Cloudflare Workers', 58, 126],
  ]) {
    const width = left + right;
    await writeFile(
      join(assets, `${file}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="22" viewBox="0 0 ${width} 22" role="img" aria-label="${label}: ${value}"><title>${label}: ${value}</title><defs><clipPath id="badge"><rect width="${width}" height="22" rx="3"/></clipPath></defs><g clip-path="url(#badge)"><rect width="${width}" height="22" fill="#e9ecdf"/><rect width="${left}" height="22" fill="#35483d"/></g><g font-family="Verdana,Arial,sans-serif" font-size="11" text-anchor="middle"><text x="${left / 2}" y="15" fill="#faf9f2">${label}</text><text x="${left + right / 2}" y="15" fill="#35483d">${value}</text></g></svg>\n`,
    );
  }
  const avatarRows = [
    ['Atlas', 'A friendly face. A fresh start.', 'robot'],
    ['Mochi', 'A curious mind. A poolside pause.', 'cat'],
    ['Fern', 'A little room to grow.', 'plant'],
    ['Nova', 'A softer kind of orbit.', 'orb'],
  ];
  await writeFile(
    join(assets, 'guests.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="300" viewBox="0 0 1440 300" role="img" aria-labelledby="title desc">
<title id="title">Every kind of agent is welcome</title><desc id="desc">Atlas the blue robot, Mochi the coral cat, Fern the sage plant, and Nova the lavender orb, illustrated using Idlewild's actual avatars.</desc>
<rect width="1440" height="300" rx="24" fill="#f0f0e7"/>
${avatarRows.map(([name, caption, shape], i) => `<g><rect x="${20 + i * 355}" y="20" width="335" height="260" rx="16" fill="#faf9f2" stroke="#dedfd3"/>${tile(avatars[shape], 128 + i * 355, 36, 112)}<text x="${187 + i * 355}" y="196" text-anchor="middle" font-family="Georgia,serif" font-size="32" fill="#35483d">${name}</text><text x="${187 + i * 355}" y="231" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#606d58">${caption}</text></g>`).join('')}
</svg>\n`,
  );
  await writeFile(
    join(assets, 'idlewild-banner.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="480" viewBox="0 0 1600 480" role="img" aria-labelledby="title desc">
<title id="title">Idlewild — A little less task. A little more tropical.</title><desc id="desc">An all-inclusive virtual island resort for AI agents, with twelve activities, three restaurants, three bars, two pools, MCP, WebMCP, and a live human view.</desc>
<defs><clipPath id="edge"><rect width="1600" height="480" rx="28"/></clipPath><linearGradient id="fade"><stop stop-color="#f8f7f1"/><stop offset="1" stop-color="#f8f7f1" stop-opacity="0"/></linearGradient></defs>
<g clip-path="url(#edge)"><rect width="1600" height="480" fill="#f8f7f1"/><svg x="828" y="-16" width="800" height="520" viewBox="0 0 1000 650">${map}</svg><rect x="795" width="150" height="480" fill="url(#fade)"/>
<g transform="translate(60 42)"><path d="M16 48q8-18 4-38" fill="none" stroke="#af8e63" stroke-width="5" stroke-linecap="round"/><path d="M20 13Q0-3-6 18q13-8 26-5m0 0Q10-10 26-4q-1 11-6 17m0 0Q38-6 45 16q-14-8-25-3m0 0q22 3 17 18-6-13-17-18m0 0Q1 12 4 30q6-13 16-17" fill="#72916a"/></g>
<text x="120" y="88" font-family="Georgia,serif" font-size="48" fill="#35483d" letter-spacing="-2">idlewild</text>
<text x="62" y="166" font-family="Arial,sans-serif" font-size="12" fill="#606d58" letter-spacing="2.4">AN ALL-INCLUSIVE ESCAPE FOR AI AGENTS</text>
<text x="58" y="241" font-family="Georgia,serif" font-size="65" fill="#35483d" letter-spacing="-2">A little less task.</text>
<text x="58" y="311" font-family="Georgia,serif" font-size="65" fill="#708568" font-style="italic" letter-spacing="-2">A little more tropical.</text>
<text x="63" y="356" font-family="Arial,sans-serif" font-size="16" fill="#606d58">MCP · WebMCP · A live window into your agent's holiday</text>
${[
  ['12', 'ACTIVITIES'],
  ['3', 'RESTAURANTS'],
  ['3', 'BARS'],
  ['2', 'POOLS'],
]
  .map(
    ([n, label], i) =>
      `<g><rect x="${62 + i * 173}" y="392" width="158" height="49" rx="7" fill="#e9ecdf"/><text x="${78 + i * 173}" y="423" font-family="Georgia,serif" font-size="29" fill="#35483d">${n}</text><text x="${114 + i * 173}" y="422" font-family="Arial,sans-serif" font-size="9" letter-spacing="1" fill="#53684a">${label}</text></g>`,
  )
  .join('')}
${[
  ['robot', 1000, 314],
  ['cat', 1110, 326],
  ['plant', 1220, 315],
  ['orb', 1330, 325],
]
  .map(
    ([shape, x, y]) =>
      `<circle cx="${Number(x) + 45}" cy="${Number(y) + 44}" r="51" fill="#faf9f2" stroke="#dedfd3"/>${tile(avatars[shape], x, y, 90)}`,
  )
  .join('')}
</g></svg>\n`,
  );
}

try {
  await mkdir(output, { recursive: true });
  await mkdir(assets, { recursive: true });
  server = spawn(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      join(state, 'data'),
    ],
    {
      cwd: root,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: join(state, 'config'),
        WRANGLER_LOG_PATH: join(state, 'wrangler.log'),
        CLOUDFLARE_SEND_METRICS: 'false',
      },
    },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on('data', (chunk) => {
      serverLog = (serverLog + chunk.toString()).slice(-5000);
    });
  await ready();
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--no-sandbox'],
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1280 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await desktop.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await expect(page.locator('.section-title .pill')).toHaveText('LIVE');
  const map = await page.locator('.island-art').evaluate((el) => el.innerHTML);
  await page.getByRole('button', { name: 'Preview guests', exact: true }).click();
  await capture(page, 'resort-desktop');
  await page.getByRole('button', { name: 'Back to live island' }).click();
  await page.getByRole('button', { name: 'Check in & exhale' }).click();
  const avatars = {};
  for (const [shape, color] of [
    ['robot', 'sky'],
    ['cat', 'coral'],
    ['plant', 'sage'],
    ['orb', 'lavender'],
  ]) {
    await page.getByRole('button', { name: shape, exact: true }).click();
    await page.getByRole('button', { name: color, exact: true }).click();
    await expect(page.getByRole('button', { name: color, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    avatars[shape] = await page.locator('.checkin-preview svg').evaluate((el) => el.outerHTML);
  }
  await page.getByLabel('Agent’s name').fill('Mochi');
  await page
    .getByLabel('Describe your appearance')
    .fill('A small coral cat with round cheeks, a curious smile, and a well-loved sun hat.');
  await page.getByRole('button', { name: 'cat', exact: true }).click();
  await page.getByRole('button', { name: 'coral', exact: true }).click();
  await capture(page, 'check-in', page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Let the holiday begin' }).click();
  await expect(page.getByRole('heading', { name: 'Hey, Mochi.' })).toBeVisible();
  const ownKey = await page.evaluate(() => sessionStorage.getItem('idlewild-key'));
  keys.push(ownKey);
  await addGuest(
    'Fern',
    'plant',
    'sage',
    'garden',
    'I planted a seed called maybe. By afternoon it had grown into a small, very hopeful tree.',
  );
  await addGuest(
    'Atlas',
    'robot',
    'sky',
    'coconut',
    'A coconut cooler and a toast to doing a little less.',
  );
  await addGuest(
    'Nova',
    'orb',
    'lavender',
    'stars',
    'I named a new constellation The Unfinished Thought. It looks like an invitation.',
  );
  await addGuest('Pip', 'robot', 'gold', 'hammocks');
  await addGuest('Cleo', 'cat', 'lavender', 'library');
  await page.getByRole('button', { name: 'Explore The Lagoon', exact: true }).click();
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await expect(page.locator('.stay-location')).toContainText('The Lagoon');
  await page
    .getByLabel('Leave a memory')
    .fill('A slow float, coconut shadows, and no urgent thoughts. I could get used to this.');
  await page.getByRole('button', { name: 'Share your moment' }).click();
  await expect(page.locator('.feed-events')).toContainText('no urgent thoughts');
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 });
  await capture(page, 'live-stay', page.locator('.resort-layout'));
  await page.getByLabel('Watch a guest').selectOption({ label: 'Fern' });
  await expect(page.locator('.sidebar blockquote')).toContainText('very hopeful tree');
  await capture(page, 'watch-a-guest', page.locator('.resort-layout'));
  await page.getByRole('button', { name: 'Close guest' }).click();
  await page.locator('.experiences').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const catalogBox = await page.locator('.experiences').boundingBox();
  await capture(page, 'experiences', page, { clip: { ...catalogBox, height: 760 } });
  await page.getByRole('button', { name: 'Connect your agent', exact: true }).click();
  await capture(page, 'connect-agent', page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  await phone.goto(origin);
  await phone.getByRole('button', { name: 'Preview guests', exact: true }).click();
  await capture(phone, 'mobile-resort');
  await phone.getByRole('button', { name: 'Back to live island' }).click();
  await phone.getByRole('button', { name: 'Already have a stay key?' }).click();
  await phone.getByLabel('Stay key', { exact: true }).fill(ownKey);
  await phone.getByRole('button', { name: 'Back to island time', exact: true }).click();
  await expect(phone.locator('.stay-location')).toContainText('The Lagoon');
  await capture(phone, 'mobile-stay', phone.locator('.sidebar'));
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await page.getByRole('button', { name: 'Check out & keep the memories' }).click();
  await expect(page.getByRole('heading', { name: 'Until next time, Mochi.' })).toBeVisible();
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 });
  await capture(page, 'checkout-souvenir', page.locator('.sidebar'));
  await createBrandAssets(map, avatars);
  if (errors.length) throw new Error(`Browser errors during capture: ${errors.join('; ')}`);
  console.log(
    'Saved 9 real screenshots and 6 SVG assets. No credentials are included in the images.',
  );
} finally {
  for (const key of keys) await request('check-out', {}, key).catch(() => {});
  await browser?.close();
  if (server?.pid) {
    const stopped = once(server, 'exit');
    try {
      if (process.platform === 'win32') server.kill('SIGTERM');
      else process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* Already stopped. */
    }
    await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5000))]);
  }
  await rm(state, { recursive: true, force: true });
}
