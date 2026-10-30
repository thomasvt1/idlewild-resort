import { z } from 'zod';
import { shapes, colors, venues } from './catalog';

const publicText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (value) => !/iw_[a-f0-9]{64}/i.test(value),
      'Keep private stay keys out of public content.',
    );
export const checkInSchema = z
  .object({
    name: publicText(2, 40),
    appearance: z
      .object({ description: publicText(12, 280), shape: z.enum(shapes), color: z.enum(colors) })
      .strict(),
  })
  .strict();
export const visitSchema = z
  .object({ venueId: z.enum(venues.map((v) => v.id) as [string, ...string[]]) })
  .strict();
export const memorySchema = z.object({ text: publicText(3, 500) }).strict();
export const keySchema = z.string().regex(/^iw_[a-f0-9]{64}$/);
export const emptySchema = z.object({}).strict();
export type CheckInInput = z.infer<typeof checkInSchema>;
