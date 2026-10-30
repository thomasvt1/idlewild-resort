import { Resort } from '../../worker/resort';
// This probe is compiled only into the isolated test bundle, never into the deployed Worker.
export class InspectedResort extends Resort {
  async fetch(request: Request) {
    if (new URL(request.url).pathname === '/test/alarm') {
      if (request.method === 'DELETE') await this.ctx.storage.deleteAlarm();
      return Response.json({ alarm: await this.ctx.storage.getAlarm() });
    }
    return super.fetch(request);
  }
}
export default { fetch: () => new Response('Isolated storage test fixture') };
