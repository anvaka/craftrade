import { describe, expect, it, vi } from 'vitest';
import { defaultProvider } from '../../server/default-provider.ts';
import { BedrockProvider, DEFAULT_MODEL_ID, SYSTEM_PROMPT, hasBedrockCredentials, userTurn } from '../../server/bedrock.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import type { ApiError, FuseRes, HelloRes } from '../../src/shared/protocol.ts';
import { GLYPHS, PRIMITIVES } from '../../src/shared/vocab.ts';
import { world } from './helpers.ts';

// No network here: the SDK client is given a fetch that records the request
// and plays back a canned Messages API response.

const [A, B] = BASE_ITEMS;
const good = { names: ['Greased hone', 'Tallow stone', 'Slick whetstone'], glyph: 'stone', tags: ['stone', 'grease'], effects: [{ p: 'crit', l: 2, neg: false }, { p: 'rate', l: 2, neg: false }] };

const message = (text: string, stop = 'end_turn') => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'test', content: [{ type: 'text', text }],
  stop_reason: stop, stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
});

function recorder(reply: (n: number) => Response | Promise<Response>) {
  const calls: { url: string; headers: Headers; body: any }[] = [];
  const fetch = (async (url: unknown, init: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
    return reply(calls.length);
  }) as typeof globalThis.fetch;
  return { calls, provider: (timeoutMs?: number) => new BedrockProvider({ fetch, apiKey: 'test-bearer-token', region: 'eu-west-1', timeoutMs }) };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Bedrock provider', () => {
  it('sends a static cached system prompt, the pair in the user turn, and asks for structured output', async () => {
    const r = recorder(() => json(message(JSON.stringify(good))));
    const provider = r.provider();
    const pick = await provider.propose(A, B, 22, 'k', new AbortController().signal);
    expect(pick).toEqual(good);

    const [call] = r.calls;
    expect(call.url).toBe('https://bedrock-mantle.eu-west-1.api.aws/anthropic/v1/messages');
    expect(call.headers.get('authorization')).toBe('Bearer test-bearer-token');
    expect(call.body.model).toBe(process.env.CRAFT_MODEL_ID ?? DEFAULT_MODEL_ID);
    expect(call.body.system).toEqual([{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]);
    expect(call.body.messages).toEqual([{ role: 'user', content: userTurn(A, B, 22) }]);
    expect(call.body.output_config.effort).toBe('low');
    expect(call.body.output_config.format.type).toBe('json_schema');
    const schema = call.body.output_config.format.schema;
    expect(schema.properties.effects.items.properties.p.enum).toEqual(PRIMITIVES.map((p) => p.id));
    expect(schema.properties.glyph.enum).toEqual([...GLYPHS]);
    // Parameters current models reject are not sent.
    for (const k of ['temperature', 'top_p', 'top_k', 'tool_choice', 'thinking']) expect(call.body).not.toHaveProperty(k);

    // A second call for another pair reuses the prefix byte for byte.
    await provider.propose(B, BASE_ITEMS[2], 30, 'k2', new AbortController().signal);
    expect(JSON.stringify(r.calls[1].body.system)).toBe(JSON.stringify(call.body.system));
    expect(r.calls[1].body.output_config).toEqual(call.body.output_config);
    expect(r.calls[1].body.messages[0].content).not.toBe(call.body.messages[0].content);
  });

  it('keeps the system prompt free of per-request data and lists the whole vocabulary', () => {
    for (const p of PRIMITIVES) expect(SYSTEM_PROMPT).toContain(`| ${p.id} | ${p.kind} |`);
    for (const p of PRIMITIVES) expect(SYSTEM_PROMPT).toContain(p.hint);
    expect(SYSTEM_PROMPT).toMatch(/Do not add an effect just to use up the budget/);
    expect(SYSTEM_PROMPT).toMatch(/Sentence case/);
    expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    // Long enough to cache on models with a 512-token minimum.
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(4000);
  });

  it('puts only item data in the user turn, never a player name', () => {
    const fused = { ...A, id: 'fabc', name: 'Greased hone', by: 'Cooper 412' };
    const turn = userTurn(fused, B, 31);
    expect(turn).not.toContain('Cooper');
    expect(JSON.parse(turn)).toEqual({
      budget: 31,
      a: { name: 'Greased hone', tier: expect.any(Number), tags: A.tags, effects: A.effects.map((e) => ({ p: e.p, l: e.l, neg: !!e.neg })) },
      b: { name: B.name, tier: expect.any(Number), tags: B.tags, effects: B.effects.map((e) => ({ p: e.p, l: e.l, neg: !!e.neg })) },
    });
  });

  it('feeds a fusion end to end and reports llm: true', async () => {
    const r = recorder(() => json(message(JSON.stringify(good))));
    const w = world({ provider: r.provider() });
    const hello = await w.post<HelloRes>('/api/hello');
    expect(hello.body.llm).toBe(true);
    const res = await w.post<FuseRes>('/api/fuse', hello.body.token, { a: B.id, b: A.id, ctx: 'run' });
    expect(res.status).toBe(200);
    expect(res.body.item.name).toBe('Greased hone');
    expect(res.body.item.effects.map((e) => e.p).sort()).toEqual(['crit', 'rate']);
    expect(r.calls.length).toBe(1);
    // The pair is always described in id order, whichever way round it was offered.
    const sent = JSON.parse(r.calls[0].body.messages[0].content);
    expect([sent.a.name, sent.b.name]).toEqual(A.id < B.id ? [A.name, B.name] : [B.name, A.name]);
    const row = w.db.prepare('SELECT model, raw FROM recipes').get() as { model: string; raw: string };
    expect(row.model).toBe(process.env.CRAFT_MODEL_ID ?? DEFAULT_MODEL_ID);
    expect(JSON.parse(row.raw)).toEqual(good);
  });

  it('treats refusals, truncation, broken JSON, off-schema output and HTTP errors as model_down after one retry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const replies: (() => Response)[] = [
      () => json(message('', 'refusal')),
      () => json(message(JSON.stringify(good).slice(0, 40), 'max_tokens')),
      () => json(message('Here is your item: a sword')),
      () => json(message(JSON.stringify({ ...good, effects: [{ p: 'godmode', l: 9, neg: false }] }))),
      () => json({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, 529),
      () => json({ type: 'error', error: { type: 'authentication_error', message: 'expired token' } }, 401),
    ];
    for (const reply of replies) {
      const r = recorder(reply);
      const w = world({ provider: r.provider() });
      const token = await w.player(5);
      const res = await w.post<ApiError>('/api/fuse', token, { a: A.id, b: B.id, ctx: 'run' });
      expect([res.status, res.body.code]).toEqual([503, 'model_down']);
      expect(r.calls.length).toBe(2);
      expect((await w.me(token)).novelLeft).toBe(20);
      expect((w.db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number }).n).toBe(0);
    }
    warn.mockRestore();
  });

  it('gives up on a slow model and recovers on the retry if it answers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = recorder((n) => (n === 1 ? new Promise<Response>(() => {}) : json(message(JSON.stringify(good)))));
    const w = world({ provider: r.provider(50), modelTimeoutMs: 50 });
    const token = await w.player(5);
    const res = await w.post<FuseRes>('/api/fuse', token, { a: A.id, b: B.id, ctx: 'run' });
    expect(res.status).toBe(200);
    expect(res.body.first).toBe(true);
    expect(r.calls.length).toBe(2);
    warn.mockRestore();
  });

  it('chooses the provider from the environment', () => {
    expect(hasBedrockCredentials({})).toBe(false);
    expect(hasBedrockCredentials({ AWS_BEARER_TOKEN_BEDROCK: 'x' })).toBe(true);
    expect(hasBedrockCredentials({ AWS_ACCESS_KEY_ID: 'x' })).toBe(false);
    expect(hasBedrockCredentials({ AWS_ACCESS_KEY_ID: 'x', AWS_SECRET_ACCESS_KEY: 'y' })).toBe(true);
    expect(defaultProvider({}).llm).toBe(false);
    expect(defaultProvider({ AWS_BEARER_TOKEN_BEDROCK: 'x', CRAFT_PROVIDER: 'procedural' }).llm).toBe(false);
  });
});
