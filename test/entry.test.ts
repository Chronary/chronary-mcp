import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const testDir = dirname(fileURLToPath(import.meta.url));
const entryPath = resolve(testDir, '../src/index.ts');
const entrySource = readFileSync(entryPath, 'utf8');

describe('src/index.ts', () => {
  it('starts with a Node shebang so it can be launched via npx', () => {
    const firstLine = entrySource.split('\n')[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });

  it('redirects console.log to console.error before any other import', () => {
    // stdout must be kept clean for JSON-RPC. The redirect must run first so any
    // transitive module with a console.log banner is caught.
    const lines = entrySource.split('\n');
    const redirectIdx = lines.findIndex((l) => l.includes('console.log = console.error'));
    const firstImportIdx = lines.findIndex((l) => l.startsWith('import '));
    expect(redirectIdx).toBeGreaterThan(-1);
    expect(firstImportIdx).toBeGreaterThan(redirectIdx);
  });

  it('registers handlers for SIGINT and SIGTERM', () => {
    expect(entrySource).toContain("process.on('SIGINT'");
    expect(entrySource).toContain("process.on('SIGTERM'");
  });

  it('imports ChronaryToolkit from the @chronary/toolkit/mcp subpath', () => {
    expect(entrySource).toContain("from '@chronary/toolkit/mcp'");
  });

  it('reads CHRONARY_API_KEY from environment', () => {
    expect(entrySource).toContain('CHRONARY_API_KEY');
  });

  it('uses StdioServerTransport', () => {
    expect(entrySource).toContain('StdioServerTransport');
  });
});
