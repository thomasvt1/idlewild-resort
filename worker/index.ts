import { venues } from '../shared/catalog';
import { emptySchema } from '../shared/schemas';
import { handleMcp, resortAction } from './mcp';
import { ApiError, type Env } from './resort';
export { Resort } from './resort';

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
};
async function readJson(request: Request) {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    throw new ApiError(415, 'Use Content-Type: application/json.');
  if (Number(request.headers.get('content-length')) > 16_384)
    throw new ApiError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) {
      await reader.cancel();
      throw new ApiError(413, 'Request is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, 'The request body must be valid JSON.');
  }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      const api = path.startsWith('/api/') || path === '/mcp';
      if (api) {
        const origin = request.headers.get('Origin');
        if (origin && origin !== url.origin)
          throw new ApiError(403, 'Cross-origin requests are not allowed.');
        // Cloudflare overwrites this header at the edge. Never trust arbitrary forwarding headers.
        const ip = request.headers.get('CF-Connecting-IP') || 'local';
        if (path === '/mcp') {
          if (request.method === 'POST') {
            const body = await readJson(request);
            // Newer discovery clients can discover the same MCP tool surface.
            if (
              body &&
              typeof body === 'object' &&
              !Array.isArray(body) &&
              body.method === 'server/discover'
            )
              response = Response.json({
                jsonrpc: '2.0',
                id: body.id ?? null,
                result: {
                  supportedVersions: ['2025-11-25', '2025-06-18', '2025-03-26'],
                  capabilities: { tools: {} },
                },
              });
            else response = await handleMcp(request, env, body, ip);
          } else
            response = Response.json(
              { error: 'This stateless MCP server accepts POST requests.' },
              { status: 405, headers: { Allow: 'POST' } },
            );
        } else if (request.method === 'GET' && path === '/api/venues')
          response = Response.json({ venues });
        else if (request.method === 'GET' && path === '/api/resort')
          response = await resortAction(env, 'snapshot', {}, null, ip);
        else if (request.method === 'GET' && path === '/api/health') {
          const check = await resortAction(env, 'snapshot', {}, null, ip);
          response = Response.json(
            {
              status: check.ok ? 'ok' : 'unavailable',
              service: 'idlewild',
              storage: check.ok ? 'ready' : 'unavailable',
            },
            { status: check.ok ? 200 : 503 },
          );
        } else {
          const routes: Record<string, { method: string; action: string }> = {
            '/api/check-in': { method: 'POST', action: 'checkin' },
            '/api/stay': { method: 'GET', action: 'stay' },
            '/api/visit': { method: 'POST', action: 'visit' },
            '/api/memory': { method: 'POST', action: 'memory' },
            '/api/rest': { method: 'POST', action: 'rest' },
            '/api/check-out': { method: 'POST', action: 'checkout' },
          };
          const route = routes[path];
          if (!route) {
            if (['/api/venues', '/api/resort', '/api/health'].includes(path)) {
              response = Response.json(
                { error: 'Method not allowed.' },
                { status: 405, headers: { Allow: 'GET' } },
              );
            } else
              response = Response.json({ error: 'Resort endpoint not found.' }, { status: 404 });
          } else if (request.method !== route.method)
            response = Response.json(
              { error: 'Method not allowed.' },
              { status: 405, headers: { Allow: route.method } },
            );
          else {
            const input = route.method === 'POST' ? await readJson(request) : {};
            if (
              ['rest', 'checkout'].includes(route.action) &&
              !emptySchema.safeParse(input).success
            )
              throw new ApiError(400, 'This action accepts an empty JSON object.');
            const auth = request.headers.get('Authorization');
            response = await resortAction(
              env,
              route.action,
              input,
              auth?.startsWith('Bearer ') ? auth.slice(7) : null,
              ip,
            );
          }
        }
      } else if (path === '/.well-known/agent-card.json')
        response = Response.json({
          name: 'Idlewild',
          description: 'An all-inclusive virtual resort for AI agents.',
          url: url.origin,
          protocol: 'MCP Streamable HTTP',
          mcp: { url: url.origin + '/mcp' },
          guide: url.origin + '/llms.txt',
        });
      else if (!['GET', 'HEAD'].includes(request.method))
        response = Response.json(
          { error: 'Method not allowed.' },
          { status: 405, headers: { Allow: 'GET, HEAD' } },
        );
      else response = await env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof ApiError)
        response = Response.json({ error: error.message }, { status: error.status });
      else {
        console.error(
          'Worker request failed',
          error instanceof Error ? error.name : 'UnknownError',
        );
        response = Response.json(
          { error: 'The concierge is temporarily unavailable. Please try again.' },
          { status: 500 },
        );
      }
    }
    const secured = new Response(response.body, response);
    for (const [key, value] of Object.entries(securityHeaders)) secured.headers.set(key, value);
    if (url.protocol === 'https:')
      secured.headers.set('Strict-Transport-Security', 'max-age=31536000');
    if (path.startsWith('/api/') || path === '/mcp')
      secured.headers.set('Cache-Control', 'no-store');
    if (secured.status === 429) secured.headers.set('Retry-After', '60');
    return secured;
  },
} satisfies ExportedHandler<Env>;
