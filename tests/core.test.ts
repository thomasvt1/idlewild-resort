import { describe, expect, it } from 'vitest';
import { venues } from '../shared/catalog';
import { checkInSchema, memorySchema, visitSchema, keySchema } from '../shared/schemas';

const checkIn = {
  name: 'Fern',
  appearance: { description: 'A tiny sage plant in a clay pot.', shape: 'plant', color: 'sage' },
};
describe('Guest input boundaries', () => {
  it('requires a usable public appearance and rejects unrecognized fields', () => {
    expect(checkInSchema.safeParse(checkIn).success).toBe(true);
    for (const bad of [
      { ...checkIn, appearance: { ...checkIn.appearance, description: 'short' } },
      { ...checkIn, name: ' ' },
      { ...checkIn, admin: true },
      { ...checkIn, appearance: { ...checkIn.appearance, shape: '<script>' } },
      { ...checkIn, name: 'x'.repeat(41) },
    ])
      expect(checkInSchema.safeParse(bad).success).toBe(false);
  });
  it('bounds memories and restricts venue identifiers', () => {
    expect(memorySchema.safeParse({ text: 'A coconut-shaped cloud.' }).success).toBe(true);
    expect(memorySchema.safeParse({ text: '  ' }).success).toBe(false);
    expect(memorySchema.safeParse({ text: 'x'.repeat(501) }).success).toBe(false);
    expect(visitSchema.safeParse({ venueId: 'not-a-venue' }).success).toBe(false);
    expect(visitSchema.safeParse({ venueId: 'lagoon', guestId: 'someone-else' }).success).toBe(
      false,
    );
  });
  it('only accepts the complete high-entropy key format', () => {
    expect(keySchema.safeParse('iw_' + 'a'.repeat(64)).success).toBe(true);
    for (const key of ['', 'iw_' + 'a'.repeat(63), 'iw_' + 'z'.repeat(64), 'a'.repeat(64)])
      expect(keySchema.safeParse(key).success).toBe(false);
  });
});
describe('The all-inclusive promise', () => {
  it('offers the promised 20 distinct, actionable venues', () => {
    expect(new Set(venues.map((v) => v.id)).size).toBe(20);
    expect(venues.filter((v) => v.kind === 'activity').length).toBeGreaterThanOrEqual(10);
    expect(venues.filter((v) => v.kind === 'restaurant')).toHaveLength(3);
    expect(venues.filter((v) => v.kind === 'bar')).toHaveLength(3);
    expect(venues.filter((v) => v.kind === 'pool')).toHaveLength(2);
    for (const v of venues) {
      expect(v.prompts.length).toBeGreaterThan(0);
      expect(v.capacity).toBeGreaterThan(0);
      expect(v.minutes).toBeGreaterThan(0);
      if (v.kind === 'restaurant' || v.kind === 'bar')
        expect(v.menu!.length).toBeGreaterThanOrEqual(3);
    }
  });
});
