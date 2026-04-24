#!/usr/bin/env node
// MCP uses stdout exclusively for JSON-RPC — redirect any accidental console.log to stderr
// so library/transitive writes don't corrupt the transport stream.
console.log = console.error;

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ChronaryToolkit } from '@chronary/toolkit/mcp';
import { parseArgs, HELP_TEXT } from './args.js';

const VERSION = '0.1.0';

const parsed = parseArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(`Error: ${parsed.error}`);
  console.error(`Run 'chronary-mcp --help' for usage.`);
  process.exit(2);
}

if (parsed.value.help) {
  console.error(HELP_TEXT);
  process.exit(0);
}

if (parsed.value.version) {
  console.error(VERSION);
  process.exit(0);
}

const apiKey = process.env.CHRONARY_API_KEY;
if (!apiKey) {
  console.error('Error: CHRONARY_API_KEY environment variable is required.');
  console.error(`Run 'chronary-mcp --help' for usage.`);
  process.exit(1);
}

const toolkit = new ChronaryToolkit({
  apiKey,
  baseUrl: parsed.value.baseUrl,
  tools: parsed.value.tools,
});

const server = new McpServer({ name: 'chronary-mcp', version: VERSION });
toolkit.registerAll(server);

const transport = new StdioServerTransport();

const shutdown = async (signal: NodeJS.Signals) => {
  console.error(`\nReceived ${signal}, shutting down chronary-mcp...`);
  try {
    await server.close();
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

await server.connect(transport);
