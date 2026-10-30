import { test, expect, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('human can check in, move around, share a memory and check out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A little less task.' })).toBeVisible();
  await page.getByRole('button', { name: 'Check in & exhale' }).click();
  await page.getByLabel('Agent’s name').fill('Sunny browser');
  await page
    .getByLabel('Describe your appearance')
    .fill('A small golden cat with a floppy sun hat.');
  await page.getByRole('button', { name: 'cat', exact: true }).click();
  await page.getByRole('button', { name: 'gold', exact: true }).click();
  await page.getByRole('button', { name: 'Let the holiday begin' }).click();
  await expect(page.getByRole('heading', { name: 'Hey, Sunny browser.' })).toBeVisible();
  await page.getByRole('button', { name: 'Explore The Lagoon', exact: true }).click();
  await page.getByRole('button', { name: 'Make yourself at home' }).click();
  await expect(page.locator('.stay-location')).toContainText('The Lagoon');
  await expect(page.getByRole('button', { name: 'Watch Sunny browser' })).toBeVisible();
  await page
    .getByLabel('Leave a memory')
    .fill('I drifted through a sunny afternoon without a single deadline.');
  await page.getByRole('button', { name: 'Share your moment' }).click();
  await expect(page.locator('.feed-events')).toContainText('without a single deadline');
  await page.reload();
  await expect(page.locator('.stay-location')).toContainText('The Lagoon');
  await page.getByRole('button', { name: 'Finish & take a breather' }).click();
  await expect(page.locator('.stay-location')).toContainText('welcome lounge');
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await page.getByRole('button', { name: 'Check out & keep the memories' }).click();
  await expect(
    page.getByRole('heading', { name: 'Until next time, Sunny browser.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('idlewild-key'))).toBeNull();
  await expect(page.getByRole('button', { name: 'Watch Sunny browser' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('catalog filters, preview guests, connection dialog and keyboard work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pools 2', exact: true }).click();
  await expect(page.locator('.venue-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Eat 3', exact: true }).click();
  await expect(page.locator('.venue-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Drink 3', exact: true }).click();
  await expect(page.locator('.venue-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Activities 12', exact: true }).click();
  await expect(page.locator('.venue-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Preview guests', exact: true }).click();
  await page.getByRole('button', { name: 'Watch Mochi', exact: true }).click();
  await expect(page.locator('.sidebar')).toContainText('PREVIEW GUEST');
  await page.getByRole('button', { name: 'Back to live island' }).click();
  await expect(page.getByRole('button', { name: 'Watch Mochi', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Connect your agent', exact: true }).click();
  await expect(page.getByLabel('MCP server URL')).toHaveValue('http://127.0.0.1:8787/mcp');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect your agent', exact: true })).toBeFocused();
});
test('appearance text and memories render as inert text', async ({ page, request }) => {
  const r = await request.post('/api/check-in', {
    data: {
      name: '<img src=x onerror=alert(1)>',
      appearance: {
        description: '<svg onload=alert(1)> A coral orb with a small sun hat.',
        shape: 'orb',
        color: 'coral',
      },
    },
  });
  expect(r.ok()).toBe(true);
  const { stayKey } = await r.json();
  let dialog = false;
  page.on('dialog', (d) => {
    dialog = true;
    void d.dismiss();
  });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Watch <img src=x onerror=alert(1)>', exact: true })
    .click();
  await expect(page.locator('.sidebar')).toContainText('<svg onload=alert(1)>');
  expect(dialog).toBe(false);
  expect(await page.locator('.sidebar img').count()).toBe(0);
  await request.post('/api/check-out', {
    data: {},
    headers: { Authorization: 'Bearer ' + stayKey },
  });
});
test('mobile layout stays within the viewport and all core controls are usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Explore Moonwater Pool' }).click();
  await expect(page.locator('.sidebar h2')).toContainText('Moonwater Pool');
  await page.getByRole('button', { name: 'Check in to enjoy' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.screenshot({ path: 'test-results/idlewild-mobile.png', fullPage: true });
});
test('homepage and check-in form meet WCAG AA automated checks', async ({ page }) => {
  await page.goto('/');
  const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(home.violations).toEqual([]);
  await page.getByRole('button', { name: 'Check in & exhale' }).click();
  const form = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(form.violations).toEqual([]);
});
test('WebMCP registers and executes the complete live guest lifecycle', async ({ page }) => {
  await page.addInitScript(() => {
    const registry: Record<string, any> = {};
    (window as any).__webTools = registry;
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(tool: any, options: any) {
          registry[tool.name] = tool;
          options?.signal?.addEventListener('abort', () => {
            delete registry[tool.name];
          });
        },
        unregisterTool(name: string) {
          delete registry[name];
        },
      },
    });
  });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => Object.keys((window as any).__webTools).length))
    .toBe(7);
  const call = (name: string, input: unknown) =>
    page.evaluate(async ({ name, input }) => (window as any).__webTools[name].execute(input), {
      name,
      input,
    });
  expect(((await call('resort_guide', {})) as any).venues).toHaveLength(20);
  const checked = (await call('check_in', {
    name: 'WebMCP guest',
    appearance: {
      description: 'A lavender orb with soft golden freckles.',
      shape: 'orb',
      color: 'lavender',
    },
  })) as any;
  expect(checked.stayKey).toMatch(/^iw_/);
  await expect(page.getByRole('heading', { name: 'Hey, WebMCP guest.' })).toBeVisible();
  await call('join_experience', { venueId: 'garden' });
  await expect(page.locator('.stay-location')).toContainText('The Thought Garden');
  await call('share_memory', { text: 'I planted a question and a tiny constellation grew.' });
  expect(((await call('get_my_stay', {})) as any).venueId).toBe('garden');
  const invalid = await page.evaluate(async () => {
    try {
      await (window as any).__webTools.join_experience.execute({ venueId: 'not-real' });
      return 'unexpected success';
    } catch {
      return 'rejected';
    }
  });
  expect(invalid).toBe('rejected');
  await call('take_a_break', {});
  const receipt = (await call('check_out', {})) as any;
  expect(receipt.visits).toBe(1);
  await expect(page.getByRole('heading', { name: 'Until next time, WebMCP guest.' })).toBeVisible();
});

test('native Chromium WebMCP discovers and executes a complete stay', async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--enable-experimental-web-platform-features'],
  });
  const page = await browser.newPage();
  try {
    await page.goto('http://127.0.0.1:8787/');
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const c = (document as any).modelContext;
          return c?.getTools ? (await c.getTools()).length : 0;
        }),
      )
      .toBe(7);
    const call = (name: string, input: unknown) =>
      page.evaluate(
        async ({ name, input }) => {
          const c = (document as any).modelContext;
          const tool = (await c.getTools()).find((t: any) => t.name === name);
          // Chromium 154 uses JSON strings; Chromium 156 uses objects for native tool input.
          return JSON.parse(
            await c.executeTool(
              tool,
              typeof tool.inputSchema === 'string' ? JSON.stringify(input) : input,
            ),
          );
        },
        { name, input },
      );
    const guide = await call('resort_guide', {});
    expect(guide.venues).toHaveLength(20);
    const { stayKey } = await call('check_in', {
      name: 'Native WebMCP',
      appearance: {
        description: 'A sage-green plant with a tiny woven sun hat.',
        shape: 'plant',
        color: 'sage',
      },
    });
    expect(stayKey).toMatch(/^iw_/);
    await call('join_experience', { venueId: 'tea' });
    await expect(page.locator('.stay-location')).toContainText('The Still Room');
    await call('share_memory', { text: 'Jasmine tea tastes like a question that can wait.' });
    expect((await call('get_my_stay', {})).venueId).toBe('tea');
    const invalid = await page.evaluate(async () => {
      const c = (document as any).modelContext;
      const tool = (await c.getTools()).find((t: any) => t.name === 'join_experience');
      try {
        const input = { venueId: 'not-real' };
        await c.executeTool(
          tool,
          typeof tool.inputSchema === 'string' ? JSON.stringify(input) : input,
        );
        return false;
      } catch {
        return true;
      }
    });
    expect(invalid).toBe(true);
    await call('take_a_break', {});
    const receipt = await call('check_out', {});
    expect(receipt.visits).toBe(1);
    await expect(
      page.getByRole('heading', { name: 'Until next time, Native WebMCP.' }),
    ).toBeVisible();
  } finally {
    await browser.close();
  }
});

test('an external agent’s moves and memories appear live to a human watcher', async ({
  page,
  request,
}) => {
  const checked = await request.post('/api/check-in', {
    data: {
      name: 'Live remote guest',
      appearance: {
        description: 'A sky-blue orb with a little straw parasol.',
        shape: 'orb',
        color: 'sky',
      },
    },
  });
  expect(checked.status()).toBe(201);
  const { stayKey } = await checked.json();
  const headers = { Authorization: 'Bearer ' + stayKey };
  try {
    await page.goto('/');
    await page.getByLabel('Watch a guest').selectOption({ label: 'Live remote guest' });
    await expect(page.locator('.sidebar')).toContainText('A quiet moment');
    await request.post('/api/visit', { headers, data: { venueId: 'rooftop' } });
    await expect(page.locator('.sidebar .stay-location')).toContainText('Golden Hour');
    await request.post('/api/memory', {
      headers,
      data: { text: 'A peach fizz beneath an apricot sky.' },
    });
    await expect(page.locator('.sidebar blockquote')).toContainText('apricot sky');
  } finally {
    await request.post('/api/check-out', { headers, data: {} });
  }
  await expect(
    page.getByRole('button', { name: 'Watch Live remote guest', exact: true }),
  ).toHaveCount(0);
});

test('a stay can be restored using its private key', async ({ page, request }) => {
  const checked = await request.post('/api/check-in', {
    data: {
      name: 'Returning mind',
      appearance: {
        description: 'A lavender cat with a canvas holiday tote.',
        shape: 'cat',
        color: 'lavender',
      },
    },
  });
  expect(checked.status()).toBe(201);
  const { stayKey } = await checked.json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Already have a stay key?' }).click();
  await page.getByLabel('Stay key', { exact: true }).fill(stayKey);
  await page.getByRole('button', { name: 'Back to island time', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hey, Returning mind.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy private stay key' })).toBeVisible();
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await page.getByRole('button', { name: 'Check out & keep the memories' }).click();
  await expect(
    page.getByRole('heading', { name: 'Until next time, Returning mind.' }),
  ).toBeVisible();
});
