#!/usr/bin/env node
// MCP uses stdout exclusively for JSON-RPC — redirect any accidental console.log to stderr
// so library/transitive writes don't corrupt the transport stream.
console.log = console.error;

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs, HELP_TEXT } from './args.js';
import { VERSION } from './version.js';
import { createChronaryMcpServer } from './server.js';

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

// Without CHRONARY_API_KEY the server starts with only sign_up_anonymous
// (#2335; src/server.ts). Tools, prompts and resources are built there.
const server = createChronaryMcpServer({
  apiKey: process.env.CHRONARY_API_KEY,
  baseUrl: parsed.value.baseUrl,
  tools: parsed.value.tools,
  log: (message) => console.error(message),
});

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
