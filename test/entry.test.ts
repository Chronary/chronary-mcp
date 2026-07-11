import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import packageJson from '../package.json';
import serverJson from '../server.json';
import { VERSION } from '../src/version';

const testDir = dirname(fileURLToPath(import.meta.url));
const entryPath = resolve(testDir, '../src/index.ts');
const entrySource = readFileSync(entryPath, 'utf8');

describe('src/index.ts', () => {
  it('starts with a Node shebang so it can be launched via npx', () => {
    const firstLine = entrySource.split('\n')[0].trimEnd();
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

  it('uses the package version for --version and MCP server metadata', () => {
    expect(VERSION).toBe(packageJson.version);
    expect(entrySource).toContain("import { VERSION } from './version.js'");
  });

  // Regression guard: @chronary/mcp has a THIRD version source beyond
  // package.json + src/version.ts — server.json, the Official MCP Registry
  // manifest, which carries the version in two places (top-level + the npm
  // package entry). A stale server.json makes the registry publish fail with
  // "cannot publish duplicate version" AFTER npm already shipped the new
  // version, reddening the release coordinator. All three sources must match.
  it('keeps server.json (both version fields) in sync with package.json', () => {
    expect(serverJson.version).toBe(packageJson.version);
    const npmPkg = serverJson.packages.find((p) => p.identifier === '@chronary/mcp');
    expect(npmPkg?.version).toBe(packageJson.version);
  });
});
