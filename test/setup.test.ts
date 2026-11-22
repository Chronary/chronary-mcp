import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { ChronaryError, ConnectionError, RateLimitError, TimeoutError } from '@chronary/sdk';
import { TOOL_NAMES } from '@chronary/toolkit';
import { createChronaryMcpServer } from '../src/server';
import {
  DEFAULT_AGENT_NAME,
  SETUP_TOOL_DESCRIPTION,
  SETUP_TOOL_NAME,
  fetchCurrentTermsVersion,
  nextSteps,
  registerSetupTool,
  setupErrorResult,
  signUpAnonymous,
  type AnonymousSignUp,
  type SignUpClient,
} from '../src/setup';
import { HELP_TEXT } from '../src/args';

const SIGNED_UP: AnonymousSignUp = {
  api_key: 'chr_sk_anon',
  org_id: '11111111-2222-3333-4444-555555555555',
  agent_id: 'agt_anon0000001',
  claim_url: 'https://console.chronary.ai/claim/anonymous#token=secret',
  expires_at: '2026-11-21T12:00:00.000Z',
  plan: 'free-agent-unverified',
};

const stale = (current: string) =>
  new ChronaryError('stale', 409, 'req_1', undefined, 'tos_version_stale', {
    type: 'tos_version_stale',
    message: 'stale',
    current_version: current,
  });

function client(impl: (params: { agent_name: string; tos_version: string }) => Promise<AnonymousSignUp>) {
  const signUp = vi.fn(impl);
  return { client: { agentAuth: { signUpAnonymous: signUp } } as SignUpClient, signUp };
}

type Handler = (params: Record<string, unknown>) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;

function fakeServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: Handler; removed: boolean }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: Handler) => {
      const entry = { config, handler, removed: false };
      tools.set(name, entry);
      return { remove: () => { entry.removed = true; } };
    }),
  };
  return { server, tools };
}

const termsFetch = (version = '2026-11-12', status = 200) =>
  vi.fn(async () => new Response(JSON.stringify({ version }), { status })) as unknown as typeof fetch;

const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text);

describe('fetchCurrentTermsVersion', () => {
  it('reads the version from GET /v1/auth/terms/current', async () => {
    const f = termsFetch('2026-11-12');
    expect(await fetchCurrentTermsVersion('https://api.example.test/', f)).toBe('2026-11-12');
    expect(vi.mocked(f).mock.calls[0][0]).toBe('https://api.example.test/v1/auth/terms/current');
  });

  it('throws on a non-2xx answer or a body without a version', async () => {
    await expect(fetchCurrentTermsVersion('https://x.test', termsFetch('v', 500))).rejects.toThrow(/HTTP 500/);
    const empty = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await expect(fetchCurrentTermsVersion('https://x.test', empty)).rejects.toThrow(/Terms version/);
    const junk = vi.fn(async () => new Response('not json', { status: 200 })) as unknown as typeof fetch;
    await expect(fetchCurrentTermsVersion('https://x.test', junk)).rejects.toThrow(/Terms version/);
  });
});

describe('signUpAnonymous', () => {
  it('fetches the current Terms version when none is given and uses the default agent name', async () => {
    const { client: c, signUp } = client(async () => SIGNED_UP);
    const terms = vi.fn(async () => '2026-11-12');
    expect(await signUpAnonymous(c, {}, terms)).toEqual(SIGNED_UP);
    expect(signUp).toHaveBeenCalledWith({ agent_name: DEFAULT_AGENT_NAME, tos_version: '2026-11-12' });
  });

  it('uses the given name and version without fetching', async () => {
    const { client: c, signUp } = client(async () => SIGNED_UP);
    const terms = vi.fn(async () => 'never');
    await signUpAnonymous(c, { agent_name: 'Ops bot', tos_version: '2026-05-11' }, terms);
    expect(terms).not.toHaveBeenCalled();
    expect(signUp).toHaveBeenCalledWith({ agent_name: 'Ops bot', tos_version: '2026-05-11' });
  });

  it('retries once with current_version on 409 tos_version_stale when it read the version itself', async () => {
    const { client: c, signUp } = client(async (p) => {
      if (p.tos_version === 'old') throw stale('2026-11-20');
      return SIGNED_UP;
    });
    expect(await signUpAnonymous(c, {}, async () => 'old')).toEqual(SIGNED_UP);
    expect(signUp.mock.calls.map((call) => call[0].tos_version)).toEqual(['old', '2026-11-20']);
  });

  // Review of #2435: a version the caller passed is their choice.
  it('never swaps a tos_version the caller passed: the 409 goes back with current_version', async () => {
    const { client: c, signUp } = client(async () => {
      throw stale('2026-11-20');
    });
    const err = await signUpAnonymous(c, { tos_version: '2026-05-11' }, vi.fn()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChronaryError);
    expect(signUp).toHaveBeenCalledTimes(1);
    const r = setupErrorResult(err);
    expect(r.isError).toBe(true);
    expect(parse(r).error).toMatchObject({ type: 'tos_version_stale', current_version: '2026-11-20' });
    expect(parse(r).error.hint).toMatch(/tos_version you passed is out of date; the current version is 2026-11-20/);
  });

  it('does not retry other errors, or a stale answer naming the same version', async () => {
    const same = client(async () => { throw stale('v1'); });
    await expect(signUpAnonymous(same.client, { tos_version: 'v1' }, vi.fn())).rejects.toBeInstanceOf(ChronaryError);
    expect(same.signUp).toHaveBeenCalledTimes(1);

    const other = client(async () => { throw new Error('boom'); });
    await expect(signUpAnonymous(other.client, { tos_version: 'v1' }, vi.fn())).rejects.toThrow('boom');
    expect(other.signUp).toHaveBeenCalledTimes(1);
  });
});

describe('setupErrorResult', () => {
  it('points at the console when the no-email sign-up is switched off', () => {
    const r = setupErrorResult(new ChronaryError('off', 503, 'req', undefined, 'anonymous_signup_disabled'));
    expect(r.isError).toBe(true);
    expect(parse(r).error).toMatchObject({ type: 'anonymous_signup_disabled', message: 'off' });
    expect(parse(r).error.hint).toMatch(/console\.chronary\.ai/);
  });

  it('keeps Retry-After on a 429', () => {
    const r = setupErrorResult(new RateLimitError('limit', 'req', new Headers({ 'Retry-After': '1200' })));
    expect(parse(r).error).toMatchObject({ type: 'rate_limit_error', retry_after_seconds: 1200 });
    expect(parse(r).error.hint).toMatch(/Try again later/);
  });

  it('wraps a non-API failure', () => {
    expect(parse(setupErrorResult(new Error('no network'))).error).toEqual({ type: 'setup_failed', message: 'no network' });
    expect(parse(setupErrorResult('x')).error).toEqual({ type: 'setup_failed', message: 'x' });
  });

  it('falls back to http_<status> without an error type', () => {
    expect(parse(setupErrorResult(new ChronaryError('x', 500))).error.type).toBe('http_500');
  });

  // Review of #2435: a lost response may have created the org already.
  it.each([
    ['TimeoutError', new TimeoutError('Request timed out after 30000ms')],
    ['ConnectionError', new ConnectionError('fetch failed')],
  ])('on a lost response (%s, status 0) warns that the org may exist and a retry creates another', (_label, err) => {
    const r = setupErrorResult(err);
    expect(r.isError).toBe(true);
    expect(parse(r).error.type).toBe('connection_error');
    expect(parse(r).error.hint).toMatch(/organization may already exist; calling sign_up_anonymous again creates another one/);
  });
});

describe('registerSetupTool', () => {
  it('registers sign_up_anonymous with the Terms notice, an open-world annotation and optional inputs', () => {
    const { server, tools } = fakeServer();
    registerSetupTool(server, { onSignedUp: vi.fn(), createClient: () => client(async () => SIGNED_UP).client });
    const tool = tools.get(SETUP_TOOL_NAME)!;
    expect(tool.config.description).toBe(SETUP_TOOL_DESCRIPTION);
    expect(SETUP_TOOL_DESCRIPTION).toMatch(/accepts the Terms of Service/);
    expect(SETUP_TOOL_DESCRIPTION).toMatch(/72 hours/);
    expect(tool.config.annotations).toMatchObject({ openWorldHint: true, readOnlyHint: false, destructiveHint: true });
    expect(Object.keys(tool.config.inputSchema as object).sort()).toEqual(['agent_name', 'tos_version']);
  });

  it('on success: hands the key to onSignedUp, removes itself, returns the key, claim link and next steps', async () => {
    const { server, tools } = fakeServer();
    const onSignedUp = vi.fn();
    registerSetupTool(server, {
      baseUrl: 'https://api.example.test',
      fetch: termsFetch(),
      onSignedUp,
      createClient: () => client(async () => SIGNED_UP).client,
    });
    const tool = tools.get(SETUP_TOOL_NAME)!;
    const result = await tool.handler({});
    expect(result.isError).toBeUndefined();
    expect(parse(result)).toEqual({ ...SIGNED_UP, next_steps: nextSteps() });
    expect(onSignedUp).toHaveBeenCalledWith('chr_sk_anon');
    expect(tool.removed).toBe(true);

    // A late second call answers that the key is set, and signs up nobody.
    const again = await tool.handler({});
    expect(again.isError).toBe(true);
    expect(parse(again).error.type).toBe('already_signed_up');
    expect(onSignedUp).toHaveBeenCalledTimes(1);
  });

  it('shares one sign-up between two concurrent calls', async () => {
    const { server, tools } = fakeServer();
    let release!: () => void;
    const gate = new Promise<void>((ok) => (release = ok));
    const { client: c, signUp } = client(async () => {
      await gate;
      return SIGNED_UP;
    });
    registerSetupTool(server, { onSignedUp: vi.fn(), createClient: () => c, fetch: termsFetch() });
    const handler = tools.get(SETUP_TOOL_NAME)!.handler;
    const a = handler({ tos_version: 'v' });
    const b = handler({ tos_version: 'v' });
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(ra).toBe(rb);
  });

  it('on an API error: returns it, keeps the tool and allows a retry', async () => {
    const { server, tools } = fakeServer();
    let fail = true;
    const onSignedUp = vi.fn();
    registerSetupTool(server, {
      onSignedUp,
      createClient: () =>
        client(async () => {
          if (fail) throw new ChronaryError('full', 503, 'req', undefined, 'anonymous_signup_capacity');
          return SIGNED_UP;
        }).client,
    });
    const tool = tools.get(SETUP_TOOL_NAME)!;
    const first = await tool.handler({ tos_version: 'v' });
    expect(first.isError).toBe(true);
    expect(parse(first).error.type).toBe('anonymous_signup_capacity');
    expect(tool.removed).toBe(false);
    expect(onSignedUp).not.toHaveBeenCalled();

    fail = false;
    expect(parse(await tool.handler({ tos_version: 'v' })).api_key).toBe('chr_sk_anon');
  });

  it('still returns the key and claim link when loading the tools fails', async () => {
    const { server, tools } = fakeServer();
    registerSetupTool(server, {
      onSignedUp: () => {
        throw new Error('duplicate tool');
      },
      createClient: () => client(async () => SIGNED_UP).client,
    });
    const result = await tools.get(SETUP_TOOL_NAME)!.handler({ tos_version: 'v' });
    expect(result.isError).toBeUndefined();
    const body = parse(result);
    expect(body.claim_url).toBe(SIGNED_UP.claim_url);
    expect(body.next_steps).toEqual(nextSteps(false));
    expect(body.next_steps.join(' ')).toMatch(/Restart this MCP server with CHRONARY_API_KEY/);
  });

  it('builds a keyless SDK client against the base URL by default', async () => {
    const { server, tools } = fakeServer();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/v1/auth/terms/current')) return new Response(JSON.stringify({ version: '2026-11-12' }), { status: 200 });
      return new Response(JSON.stringify(SIGNED_UP), { status: 201, headers: { 'Content-Type': 'application/json' } });
    });
    try {
      registerSetupTool(server, { baseUrl: 'https://api.example.test', onSignedUp: vi.fn(), extraHeaders: { 'X-Chronary-Client': 'chronary-mcp/test' } });
      const result = await tools.get(SETUP_TOOL_NAME)!.handler({});
      expect(parse(result).api_key).toBe('chr_sk_anon');
      const signUpCall = fetchSpy.mock.calls.find(([input]) => String(input instanceof Request ? input.url : input).endsWith('/v1/agent/sign-up/anonymous'))!;
      const init = (signUpCall[1] ?? {}) as RequestInit;
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBeNull();
      expect(headers.get('X-Chronary-Client')).toBe('chronary-mcp/test');
      expect(JSON.parse(String(init.body))).toEqual({ agent_name: DEFAULT_AGENT_NAME, tos_version: '2026-11-12' });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

// Review of #2435: drive the real server the binary runs (src/server.ts, the
// SDK's McpServer) through a real MCP client over an in-memory transport,
// with the HTTP API stubbed at fetch.
describe('keyless start, end to end in process', () => {
  const BASE = 'https://api.example.test';

  async function connect(options: Parameters<typeof createChronaryMcpServer>[0]) {
    const server = createChronaryMcpServer(options);
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: 'test-client', version: '0.0.0' });
    let listChanged = 0;
    mcp.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      listChanged += 1;
    });
    await server.connect(serverSide);
    await mcp.connect(clientSide);
    return { mcp, server, listChanged: () => listChanged };
  }

  function stubApi() {
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      calls.push(`${method} ${url.pathname}`);
      if (url.pathname === '/v1/auth/terms/current') return Response.json({ version: '2026-11-12' });
      if (url.pathname === '/v1/agent/sign-up/anonymous') return Response.json(SIGNED_UP, { status: 201 });
      return Response.json({ error: { type: 'not_found', message: url.pathname } }, { status: 404 });
    });
    return { calls, spy };
  }

  it('lists only sign_up_anonymous, signs up, then lists the full tool set with list_changed', async () => {
    const api = stubApi();
    const log = vi.fn();
    const { mcp, server, listChanged } = await connect({ baseUrl: BASE, log });
    try {
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/CHRONARY_API_KEY is not set/));
      const before = await mcp.listTools();
      expect(before.tools.map((t) => t.name)).toEqual([SETUP_TOOL_NAME]);
      // Prompts and resources are there from the start.
      expect((await mcp.listPrompts()).prompts.length).toBeGreaterThan(0);
      expect((await mcp.listResources()).resources.map((r) => r.uri)).toContain('chronary://about');

      const result = await mcp.callTool({ name: SETUP_TOOL_NAME, arguments: { agent_name: 'In-process agent' } });
      expect(result.isError).toBeFalsy();
      const body = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(body).toMatchObject({ api_key: SIGNED_UP.api_key, claim_url: SIGNED_UP.claim_url, expires_at: SIGNED_UP.expires_at });
      expect(api.calls).toEqual(['GET /v1/auth/terms/current', 'POST /v1/agent/sign-up/anonymous']);

      const after = await mcp.listTools();
      const names = after.tools.map((t) => t.name);
      expect(names).toHaveLength(TOOL_NAMES.length);
      expect(new Set(names)).toEqual(new Set(TOOL_NAMES));
      expect(names).not.toContain(SETUP_TOOL_NAME);
      await vi.waitFor(() => expect(listChanged()).toBeGreaterThan(0));
    } finally {
      api.spy.mockRestore();
      await mcp.close();
      await server.close();
    }
  });

  it('keeps --tools after the sign-up', async () => {
    const api = stubApi();
    const { mcp, server } = await connect({ baseUrl: BASE, tools: ['list_calendars', 'create_event'] });
    try {
      await mcp.callTool({ name: SETUP_TOOL_NAME, arguments: {} });
      expect((await mcp.listTools()).tools.map((t) => t.name).sort()).toEqual(['create_event', 'list_calendars']);
    } finally {
      api.spy.mockRestore();
      await mcp.close();
      await server.close();
    }
  });

  it('with a key: every tool from the start, no setup tool', async () => {
    const { mcp, server } = await connect({ apiKey: 'chr_sk_test', baseUrl: BASE });
    try {
      const names = (await mcp.listTools()).tools.map((t) => t.name);
      expect(names).toHaveLength(TOOL_NAMES.length);
      expect(names).not.toContain(SETUP_TOOL_NAME);
    } finally {
      await mcp.close();
      await server.close();
    }
  });

  // Claude connectors directory rule (#2608): every tool has a title and is
  // either read-only or destructive, never neither (and never both).
  it('every listed tool, keyless or keyed, has a title and readOnlyHint XOR destructiveHint', async () => {
    const offending = (tools: Array<{ name: string; annotations?: Record<string, unknown> }>) =>
      tools
        .filter((t) => {
          const a = t.annotations ?? {};
          const title = typeof a.title === 'string' ? a.title.trim() : '';
          return !title || (a.readOnlyHint === true) === (a.destructiveHint === true);
        })
        .map((t) => `${t.name} ${JSON.stringify(t.annotations)}`);
    const keyless = await connect({ baseUrl: BASE, log: vi.fn() });
    const keyed = await connect({ apiKey: 'chr_sk_test', baseUrl: BASE });
    try {
      const keylessTools = (await keyless.mcp.listTools()).tools;
      const keyedTools = (await keyed.mcp.listTools()).tools;
      expect(keylessTools.map((t) => t.name)).toEqual([SETUP_TOOL_NAME]);
      expect(keyedTools).toHaveLength(TOOL_NAMES.length);
      expect(offending([...keylessTools, ...keyedTools])).toEqual([]);
    } finally {
      await keyless.mcp.close();
      await keyless.server.close();
      await keyed.mcp.close();
      await keyed.server.close();
    }
  });

  it('documents the keyless start in --help', () => {
    expect(HELP_TEXT).toMatch(/sign_up_anonymous/);
  });
});
