import { describe, it, expect } from 'vitest';
import { parseArgs, HELP_TEXT } from '../src/args';

describe('parseArgs', () => {
  it('returns empty config for no arguments', () => {
    const result = parseArgs([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({});
    }
  });

  it('parses --help and -h', () => {
    for (const flag of ['--help', '-h']) {
      const result = parseArgs([flag]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.help).toBe(true);
    }
  });

  it('parses --version and -v', () => {
    for (const flag of ['--version', '-v']) {
      const result = parseArgs([flag]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.version).toBe(true);
    }
  });

  it('parses --tools with a single valid tool', () => {
    const result = parseArgs(['--tools', 'get_usage']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tools).toEqual(['get_usage']);
  });

  it('parses --tools with multiple valid tools', () => {
    const result = parseArgs(['--tools', 'list_events,check_availability,create_event']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tools).toEqual(['list_events', 'check_availability', 'create_event']);
    }
  });

  it('trims whitespace inside --tools list', () => {
    const result = parseArgs(['--tools', 'list_events , create_event']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.tools).toEqual(['list_events', 'create_event']);
  });

  it('rejects --tools with no value', () => {
    const result = parseArgs(['--tools']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--tools requires/);
  });

  it('rejects --tools when next arg is another flag', () => {
    const result = parseArgs(['--tools', '--base-url', 'https://example.com']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--tools requires/);
  });

  it('rejects --tools with empty list', () => {
    const result = parseArgs(['--tools', ',,,']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot be empty/);
  });

  it('rejects --tools with unknown tool names', () => {
    const result = parseArgs(['--tools', 'list_events,not_a_real_tool']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown tool name/);
  });

  it('parses --base-url with a valid URL', () => {
    const result = parseArgs(['--base-url', 'http://localhost:8787']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.baseUrl).toBe('http://localhost:8787');
  });

  it('rejects --base-url with no value', () => {
    const result = parseArgs(['--base-url']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--base-url requires/);
  });

  it('rejects --base-url that is not a valid URL', () => {
    const result = parseArgs(['--base-url', 'not-a-url']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not a valid URL/);
  });

  it('parses both --tools and --base-url together', () => {
    const result = parseArgs([
      '--base-url', 'http://localhost:8787',
      '--tools', 'list_events,get_event',
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.baseUrl).toBe('http://localhost:8787');
      expect(result.value.tools).toEqual(['list_events', 'get_event']);
    }
  });

  it('rejects unknown arguments', () => {
    const result = parseArgs(['--not-a-flag']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown argument/);
  });
});

describe('HELP_TEXT', () => {
  it('mentions CHRONARY_API_KEY', () => {
    expect(HELP_TEXT).toContain('CHRONARY_API_KEY');
  });

  it('mentions --tools and --base-url', () => {
    expect(HELP_TEXT).toContain('--tools');
    expect(HELP_TEXT).toContain('--base-url');
  });
});
