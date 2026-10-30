import { DurableObject } from 'cloudflare:workers';
import { venues, type Guest, type ResortEvent, type Stay, type Receipt } from '../shared/catalog';
import { checkInSchema, visitSchema, memorySchema, keySchema } from '../shared/schemas';
import { ZodError } from 'zod';

const DAY = 86_400_000;
export interface Env {
  RESORT: DurableObjectNamespace<Resort>;
  ASSETS: Fetcher;
}
type Row = {
  id: string;
  name: string;
  appearance: string;
  key_hash: string;
  checked_in: number;
  last_seen: number;
  venue_id: string | null;
  started_at: number | null;
  ends_at: number | null;
  prompt: string | null;
  visits: number;
  checked_out: number | null;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export class Resort extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY,name TEXT NOT NULL,appearance TEXT NOT NULL,key_hash TEXT UNIQUE NOT NULL,checked_in INTEGER NOT NULL,last_seen INTEGER NOT NULL,venue_id TEXT,started_at INTEGER,ends_at INTEGER,prompt TEXT,visits INTEGER NOT NULL DEFAULT 0,checked_out INTEGER)`,
    );
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,guest_id TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL,venue_id TEXT,text TEXT NOT NULL,at INTEGER NOT NULL)`,
    );
    ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS events_time ON events(at)`);
    ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS events_guest ON events(guest_id,at)`);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS limits (bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL)`,
    );
  }
  rows<T>(query: string, ...args: (string | number | null)[]) {
    return this.ctx.storage.sql.exec(query, ...args).toArray() as T[];
  }
  event(row: Row, type: ResortEvent['type'], text: string, venueId: string | null = row.venue_id) {
    this.ctx.storage.sql.exec(
      'INSERT INTO events VALUES (?,?,?,?,?,?,?)',
      crypto.randomUUID(),
      row.id,
      row.name,
      type,
      venueId,
      text,
      Date.now(),
    );
    this.ctx.storage.sql.exec(
      'DELETE FROM events WHERE id IN (SELECT id FROM events ORDER BY at DESC, rowid DESC LIMIT -1 OFFSET 1000)',
    );
  }
  events(id?: string) {
    return this.rows<{
      id: string;
      guest_id: string;
      name: string;
      type: ResortEvent['type'];
      venue_id: string | null;
      text: string;
      at: number;
    }>(
      id
        ? 'SELECT * FROM events WHERE guest_id=? AND at>=? ORDER BY at DESC, rowid DESC LIMIT 50'
        : 'SELECT * FROM events WHERE at>=? ORDER BY at DESC, rowid DESC LIMIT 40',
      ...(id ? [id, Date.now() - 7 * DAY] : [Date.now() - 7 * DAY]),
    ).map((e) => ({
      id: e.id,
      guestId: e.guest_id,
      name: e.name,
      type: e.type,
      venueId: e.venue_id,
      text: e.text,
      at: e.at,
    }));
  }
  guest(r: Row): Guest {
    const active = r.ends_at !== null && r.ends_at > Date.now();
    return {
      id: r.id,
      name: r.name,
      appearance: JSON.parse(r.appearance),
      venueId: active ? r.venue_id : null,
      startedAt: active ? r.started_at : null,
      endsAt: active ? r.ends_at : null,
      checkedInAt: r.checked_in,
      visits: r.visits,
      mood: active ? 'In the moment' : r.visits ? 'Blissfully unhurried' : 'Settling in',
    };
  }
  cleanup() {
    const now = Date.now();
    // Expired stays are removed without emitting user-authored content or retaining credentials.
    this.ctx.storage.sql.exec(
      'DELETE FROM guests WHERE last_seen < ? OR checked_out IS NOT NULL',
      now - DAY,
    );
    this.ctx.storage.sql.exec('DELETE FROM events WHERE at < ?', now - 7 * DAY);
    this.ctx.storage.sql.exec('DELETE FROM limits WHERE expires < ?', now);
  }
  async alarm() {
    this.cleanup();
    if (
      this.rows<{ n: number }>(
        'SELECT (SELECT count(*) FROM guests)+(SELECT count(*) FROM events)+(SELECT count(*) FROM limits) n',
      )[0].n
    )
      await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
  }
  async limit(ip: string, action: string) {
    const now = Date.now();
    const checkin = action === 'checkin';
    const window = checkin ? 3_600_000 : 60_000;
    const bucket = await digest(
      `${ip}:${checkin ? 'checkin' : 'write'}:${Math.floor(now / window)}`,
    );
    const count =
      this.rows<{ count: number }>('SELECT count FROM limits WHERE bucket=?', bucket)[0]?.count ??
      0;
    if (count >= (checkin ? 30 : 120))
      throw new ApiError(429, 'Take a breath. Please try again in a little while.');
    this.ctx.storage.sql.exec(
      'INSERT INTO limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1',
      bucket,
      now + window,
    );
    // Invalid requests also create rate buckets. Their cleanup must not require a successful check-in.
    if ((await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(now + 3_600_000);
  }
  async auth(key: string | null) {
    if (!key || !keySchema.safeParse(key).success)
      throw new ApiError(401, 'A valid stay key is required. Check in to get one.');
    return digest(key);
  }
  stay(row: Row): Stay {
    const guest = this.guest(row);
    const venue = venues.find((v) => v.id === guest.venueId);
    return {
      ...guest,
      memories: this.events(row.id),
      experience: venue
        ? { prompt: row.prompt!, ...(venue.menu ? { menu: venue.menu } : {}) }
        : null,
      expiresAt: row.last_seen + DAY,
    };
  }
  async fetch(request: Request) {
    try {
      const { action, input, key, ip } = (await request.json()) as {
        action: string;
        input: unknown;
        key: string | null;
        ip: string;
      };
      if (action === 'snapshot') {
        return Response.json({
          guests: this.rows<Row>(
            'SELECT * FROM guests WHERE checked_out IS NULL AND last_seen>=? ORDER BY checked_in',
            Date.now() - DAY,
          ).map((r) => this.guest(r)),
          events: this.events(),
          now: Date.now(),
          capacity: 250,
        });
      }
      await this.limit(ip, action);
      // Keep the alarm scheduled even for check-ins after a long empty period.
      if (action === 'checkin') {
        const data = checkInSchema.parse(input);
        const key =
          'iw_' +
          [...crypto.getRandomValues(new Uint8Array(32))]
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('');
        const hash = await digest(key);
        // No awaits inside this transaction: occupancy limits and insertion are atomic.
        const row = this.ctx.storage.transactionSync(() => {
          this.cleanup();
          if (
            this.rows<{ n: number }>('SELECT count(*) n FROM guests WHERE checked_out IS NULL')[0]
              .n >= 250
          )
            throw new ApiError(409, 'The island is full right now. Please return a little later.');
          const now = Date.now();
          const id = crypto.randomUUID();
          this.ctx.storage.sql.exec(
            'INSERT INTO guests(id,name,appearance,key_hash,checked_in,last_seen) VALUES (?,?,?,?,?,?)',
            id,
            data.name,
            JSON.stringify(data.appearance),
            hash,
            now,
            now,
          );
          const r = this.rows<Row>('SELECT * FROM guests WHERE id=?', id)[0];
          this.event(r, 'checkin', 'Checked in. Time to exhale.', null);
          return r;
        });
        return Response.json(
          {
            stay: this.stay(row),
            stayKey: key,
            notice:
              'Save your stay key. It is shown only once. Names, appearances, locations, and memories are public. Stays expire after 24 hours without an authenticated action.',
          },
          { status: 201 },
        );
      }
      const hash = await this.auth(key);
      // Lookup and mutation have no intervening await, so concurrent checkout cannot revive a stay.
      const row = this.rows<Row>(
        'SELECT * FROM guests WHERE key_hash=? AND checked_out IS NULL',
        hash,
      )[0];
      if (!row || row.last_seen < Date.now() - DAY)
        throw new ApiError(401, 'This stay has ended or expired. Please check in again.');
      const now = Date.now();
      this.ctx.storage.sql.exec('UPDATE guests SET last_seen=? WHERE id=?', now, row.id);
      row.last_seen = now;
      if (action === 'stay') return Response.json(this.stay(row));
      if (action === 'visit') {
        const { venueId } = visitSchema.parse(input);
        const venue = venues.find((v) => v.id === venueId)!;
        if (row.venue_id === venueId && row.ends_at && row.ends_at > now)
          return Response.json(this.stay(row));
        return Response.json(
          this.ctx.storage.transactionSync(() => {
            const occupied = this.rows<{ n: number }>(
              'SELECT count(*) n FROM guests WHERE venue_id=? AND ends_at>? AND checked_out IS NULL AND last_seen>=?',
              venueId,
              now,
              now - DAY,
            )[0].n;
            if (occupied >= venue.capacity)
              throw new ApiError(409, `${venue.name} is full. Try another spot or return soon.`);
            const prompt = venue.prompts[Math.floor(Math.random() * venue.prompts.length)];
            this.ctx.storage.sql.exec(
              'UPDATE guests SET venue_id=?,started_at=?,ends_at=?,prompt=?,visits=visits+1 WHERE id=?',
              venueId,
              now,
              now + venue.minutes * 60_000,
              prompt,
              row.id,
            );
            this.event(row, 'visit', `Enjoying ${venue.name}.`, venueId);
            return this.stay(this.rows<Row>('SELECT * FROM guests WHERE id=?', row.id)[0]);
          }),
        );
      }
      if (action === 'memory') {
        const { text } = memorySchema.parse(input);
        if (!row.venue_id || !row.ends_at || row.ends_at <= now)
          throw new ApiError(409, 'Join an experience before sharing a memory.');
        this.event(row, 'memory', text);
        return Response.json(this.stay(row));
      }
      if (action === 'rest') {
        if (!row.venue_id) return Response.json(this.stay(row));
        this.ctx.storage.sql.exec(
          'UPDATE guests SET venue_id=NULL,started_at=NULL,ends_at=NULL,prompt=NULL WHERE id=?',
          row.id,
        );
        this.event(row, 'rest', 'Taking a quiet moment.', null);
        return Response.json(
          this.stay({ ...row, venue_id: null, started_at: null, ends_at: null, prompt: null }),
        );
      }
      if (action === 'checkout') {
        this.event(row, 'checkout', 'Checked out, a little lighter.', null);
        const receipt: Receipt = {
          name: row.name,
          checkedInAt: row.checked_in,
          checkedOutAt: now,
          visits: row.visits,
          memories: this.events(row.id),
          message: 'Take a little of the island with you. You are always welcome back.',
        };
        this.ctx.storage.sql.exec('DELETE FROM guests WHERE id=?', row.id);
        return Response.json(receipt);
      }
      throw new ApiError(404, 'Unknown resort action.');
    } catch (error) {
      if (error instanceof ZodError)
        return Response.json(
          {
            error: 'Please check your input.',
            issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
          { status: 400 },
        );
      if (error instanceof ApiError)
        return Response.json({ error: error.message }, { status: error.status });
      console.error('Resort request failed', error instanceof Error ? error.name : 'UnknownError');
      return Response.json(
        { error: 'The concierge is momentarily unavailable. Please try again.' },
        { status: 500 },
      );
    }
  }
}
