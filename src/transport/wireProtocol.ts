import { z } from 'zod';
import { GameEvent, payloadSchemas, EventType } from '../ledger/types';
import { Intent } from '../ledger/intents';

// Pure wire-protocol layer: message shapes, Zod validation, and NDJSON framing.
// No sockets, no React — see plan §2 for the flow this implements.

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 51837;

// A line (including its trailing newline) larger than this is treated as a
// protocol violation and the connection is dropped. See plan §5.4.
export const MAX_LINE_BYTES = 64 * 1024;

const eventTypeSchema = z.enum(Object.keys(payloadSchemas) as [EventType, ...EventType[]]);
const gameEventSchema: z.ZodType<GameEvent> = z.object({
  seq: z.number().int().nonnegative(),
  ts: z.number().finite(),
  actorId: z.string(),
  intentId: z.string().min(1),
  type: eventTypeSchema,
  payload: z.unknown(),
}).superRefine((event, ctx) => {
  const schema = payloadSchemas[event.type as EventType];
  const result = schema.safeParse(event.payload);
  if (!result.success) ctx.addIssue({ code: 'custom', message: 'invalid payload for event type' });
}) as unknown as z.ZodType<GameEvent>;

const intentSchema: z.ZodType<Intent> = z.object({
  type: eventTypeSchema,
  payload: z.unknown(),
  actorId: z.string(),
  intentId: z.string().min(1),
}).superRefine((intent, ctx) => {
  const schema = payloadSchemas[intent.type as EventType];
  const result = schema.safeParse(intent.payload);
  if (!result.success) ctx.addIssue({ code: 'custom', message: 'invalid payload for intent type' });
}) as unknown as z.ZodType<Intent>;

const helloSchema = z.object({
  kind: z.literal('hello'),
  protocolVersion: z.number().int(),
  clientId: z.string().min(1),
  sinceSeq: z.number().int().nonnegative(),
});
const welcomeSchema = z.object({
  kind: z.literal('welcome'),
  protocolVersion: z.number().int(),
  gameId: z.string().min(1),
  events: z.array(gameEventSchema),
});
const intentMessageSchema = z.object({ kind: z.literal('intent'), intent: intentSchema });
const eventMessageSchema = z.object({ kind: z.literal('event'), event: gameEventSchema });
const rejectSchema = z.object({ kind: z.literal('reject'), intentId: z.string().min(1), reason: z.string() });
const syncSchema = z.object({ kind: z.literal('sync'), requestId: z.string().min(1), sinceSeq: z.number().int().nonnegative() });
const syncedSchema = z.object({ kind: z.literal('synced'), requestId: z.string().min(1), events: z.array(gameEventSchema) });
const pingSchema = z.object({ kind: z.literal('ping') });
const pongSchema = z.object({ kind: z.literal('pong') });
const errorSchema = z.object({ kind: z.literal('error'), message: z.string() });

export const wireMessageSchema = z.discriminatedUnion('kind', [
  helloSchema,
  welcomeSchema,
  intentMessageSchema,
  eventMessageSchema,
  rejectSchema,
  syncSchema,
  syncedSchema,
  pingSchema,
  pongSchema,
  errorSchema,
]);

export type WireMessage = z.infer<typeof wireMessageSchema>;

/** Validate and parse a single already-JSON-parsed value as a WireMessage. */
export function parseWireMessage(input: unknown): WireMessage | null {
  const result = wireMessageSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Encode one message as an NDJSON line (JSON + trailing `\n`). */
export function encodeMessage(message: WireMessage): string {
  return JSON.stringify(message) + '\n';
}

/**
 * Parse a single NDJSON line (without its trailing newline) into a
 * WireMessage. Returns null for malformed JSON or a message that fails
 * schema validation — callers should log-and-ignore, per plan §5.4.
 */
export function decodeLine(line: string): WireMessage | null {
  if (line.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return parseWireMessage(parsed);
}

/**
 * Accumulates raw TCP chunks and splits them into NDJSON lines. TCP does not
 * preserve message boundaries, so a message may arrive split across chunks,
 * or several messages may arrive in a single chunk.
 *
 * `oversized` becomes true (permanently) once a line — or an unterminated
 * buffered remainder — exceeds MAX_LINE_BYTES; callers should close the
 * connection when they see it.
 */
export class LineBuffer {
  private buffer = '';
  oversized = false;

  /** Feed a raw chunk; returns the complete lines (newline stripped) it completed. */
  push(chunk: string): string[] {
    if (this.oversized) return [];
    this.buffer += chunk;
    const lines: string[] = [];
    let index: number;
    while ((index = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      if (byteLength(line) > MAX_LINE_BYTES) {
        this.oversized = true;
        return lines;
      }
      lines.push(line);
    }
    if (byteLength(this.buffer) > MAX_LINE_BYTES) this.oversized = true;
    return lines;
  }
}

/**
 * UTF-8 byte length of `text`, computed manually rather than via
 * Buffer/TextEncoder — neither is guaranteed present in the RN/Hermes
 * runtime this module ships in.
 */
function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i)!;
    if (code > 0xffff) i += 1; // surrogate pair consumed two UTF-16 units
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}
