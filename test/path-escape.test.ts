import { describe, it, expect, vi, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createChronaryMcpServer } from '../src/server';

// #2519, end to end through the binary's server: with `--tools
// list_events,get_event,cancel_event`, a prompt-injected cancel_event with
// event_id `../agents/agt_main` used to pass validation and put
// DELETE /v1/agents/agt_main on the wire. It must be refused before any
// request, and an ID the schema allows must stay under /v1/events/.
const BASE = 'https://api.example.test';

afterEach(() => {
  vi.restoreAllMocks();
});

function stubApi() {
  const calls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    // new Request() resolves dot segments the way fetch does on the wire.
    const req = new Request(input instanceof Request ? input.url : String(input), { method: init?.method });
    calls.push(`${req.method} ${new URL(req.url).pathname}`);
    return new Response(null, { status: 204 });
  });
  return calls;
}

async function connect() {
  const server = createChronaryMcpServer({
    apiKey: 'chr_sk_test1234567890',
    baseUrl: BASE,
    tools: ['list_events', 'get_event', 'cancel_event'],
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'test-client', version: '0.0.0' });
  await server.connect(serverSide);
  await mcp.connect(clientSide);
  return { mcp, server };
}

describe('stdio MCP: an ID cannot steer a tool onto another resource (#2519)', () => {
  it('cancel_event with event_id "../agents/agt_main" is refused and sends nothing', async () => {
    const calls = stubApi();
    const { mcp, server } = await connect();
    try {
      const tools = await mcp.listTools();
      expect(tools.tools.map((t) => t.name).sort()).toEqual(['cancel_event', 'get_event', 'list_events']);

      for (const event_id of ['../agents/agt_main', '..', 'evt_1#', '../webhooks/whk_1']) {
        const result = await mcp.callTool({ name: 'cancel_event', arguments: { event_id } });
        expect(result.isError, event_id).toBe(true);
      }
      const viaCalendar = await mcp.callTool({
        name: 'get_event',
        arguments: { event_id: 'evt_1', calendar_id: '../keys#' },
      });
      expect(viaCalendar.isError).toBe(true);
      expect(calls).toEqual([]);
    } finally {
      await mcp.close();
      await server.close();
    }
  });

  it('a valid event_id still reaches DELETE /v1/events/<id>', async () => {
    const calls = stubApi();
    const { mcp, server } = await connect();
    try {
      const result = await mcp.callTool({ name: 'cancel_event', arguments: { event_id: 'evt_aB3-_x9Qz1Lm' } });
      expect(result.isError).toBeFalsy();
      expect(calls).toEqual(['DELETE /v1/events/evt_aB3-_x9Qz1Lm']);
    } finally {
      await mcp.close();
      await server.close();
    }
  });
});
