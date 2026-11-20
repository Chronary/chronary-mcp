// Builds the chronary-mcp server (tools, prompts, resources) without a
// transport, so src/index.ts connects it to stdio and the tests connect it to
// an in-memory transport and drive it like a client would.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ChronaryToolkit, MCP_SERVER_INSTRUCTIONS } from '@chronary/toolkit/mcp';
import type { ToolName } from '@chronary/toolkit';
import { VERSION } from './version.js';
import { registerSetupTool } from './setup.js';

export interface ChronaryMcpServerOptions {
  /** CHRONARY_API_KEY. Unset or empty: the keyless start (#2335). */
  apiKey?: string;
  baseUrl?: string;
  tools?: ToolName[];
  /** Where startup notes go (stderr in the binary; stdout is JSON-RPC). */
  log?: (message: string) => void;
}

export function createChronaryMcpServer(options: ChronaryMcpServerOptions): McpServer {
  // Identify MCP traffic to the API for analytics. UA stays as `chronary-ts/...`
  // from the underlying SDK; this header surfaces the wrapper identity.
  const extraHeaders = { 'X-Chronary-Client': `chronary-mcp/${VERSION}` };

  const toolkitFor = (apiKey: string) =>
    new ChronaryToolkit({
      apiKey,
      baseUrl: options.baseUrl,
      tools: options.tools,
      extraHeaders,
    });

  // Same server instructions as the hosted server, including the rule that
  // third-party event and webhook text is data, not instructions (#1621).
  const server = new McpServer(
    { name: 'chronary-mcp', version: VERSION },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );

  if (options.apiKey) {
    const toolkit = toolkitFor(options.apiKey);
    toolkit.registerAll(server);
    toolkit.registerPrompts(server);
    toolkit.registerResources(server);
    return server;
  }

  // No key (#2335): serve only `sign_up_anonymous`. Its success registers the
  // full tool set with the new key, in this process. Prompts and resources are
  // static, and must be registered before connecting.
  options.log?.('chronary-mcp: CHRONARY_API_KEY is not set; serving only the sign_up_anonymous tool.');
  const keyless = toolkitFor('');
  keyless.registerPrompts(server);
  keyless.registerResources(server);
  registerSetupTool(server, {
    baseUrl: options.baseUrl,
    extraHeaders,
    onSignedUp: (newKey) => toolkitFor(newKey).registerAll(server),
  });
  return server;
}
