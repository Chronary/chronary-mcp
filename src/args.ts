import { TOOL_NAMES, type ToolName } from '@chronary/toolkit';

export interface ParsedArgs {
  tools?: ToolName[];
  baseUrl?: string;
  version?: boolean;
  help?: boolean;
}

export type ParseResult =
  | { ok: true; value: ParsedArgs }
  | { ok: false; error: string };

const VALID_TOOL_NAMES = new Set<string>(TOOL_NAMES);

/**
 * Parse CLI arguments. Pure function — no side effects, no process.exit.
 * Caller decides what to do with errors.
 */
export function parseArgs(argv: readonly string[]): ParseResult {
  const result: ParsedArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--version':
      case '-v':
        result.version = true;
        break;

      case '--help':
      case '-h':
        result.help = true;
        break;

      case '--tools': {
        const value = argv[i + 1];
        if (!value || value.startsWith('-')) {
          return { ok: false, error: '--tools requires a comma-separated list of tool names' };
        }
        const requested = value.split(',').map((t) => t.trim()).filter(Boolean);
        if (requested.length === 0) {
          return { ok: false, error: '--tools list cannot be empty' };
        }
        const invalid = requested.filter((t) => !VALID_TOOL_NAMES.has(t));
        if (invalid.length > 0) {
          return { ok: false, error: `unknown tool name(s): ${invalid.join(', ')}` };
        }
        result.tools = requested as ToolName[];
        i++;
        break;
      }

      case '--base-url': {
        const value = argv[i + 1];
        if (!value || value.startsWith('-')) {
          return { ok: false, error: '--base-url requires a URL' };
        }
        try {
          new URL(value);
        } catch {
          return { ok: false, error: `--base-url is not a valid URL: ${value}` };
        }
        result.baseUrl = value;
        i++;
        break;
      }

      default:
        return { ok: false, error: `unknown argument: ${arg}` };
    }
  }

  return { ok: true, value: result };
}

export const HELP_TEXT = `chronary-mcp — MCP server for Chronary

Usage:
  chronary-mcp [options]

Environment:
  CHRONARY_API_KEY   Required. Your Chronary API key (chr_sk_...).

Options:
  --tools <names>    Comma-separated list of tool names to expose (default: all 23 tools).
                     Example: --tools list_events,check_availability,create_event
  --base-url <url>   Override the API base URL (default: https://api.chronary.ai).
  --version, -v      Print version and exit.
  --help, -h         Print this help and exit.

Docs:
  https://docs.chronary.ai
`;
