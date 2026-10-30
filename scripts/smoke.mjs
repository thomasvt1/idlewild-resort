const origin = process.env.IDLEWILD_URL;
if (!origin || new URL(origin).protocol !== 'https:')
  throw new Error('Set IDLEWILD_URL to the deployed HTTPS origin.');
for (const path of ['/', '/api/health', '/api/venues', '/llms.txt']) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Deployment check failed at ${path}: ${response.status}`);
  if (path === '/api/health' && (await response.json()).storage !== 'ready')
    throw new Error('Storage is not ready.');
  console.log(`Verified ${path}`);
}
