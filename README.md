# @chronary/mcp

[![Smithery](https://smithery.ai/badge/chronary/agent-calendar)](https://smithery.ai/server/chronary/agent-calendar)

MCP server for [Chronary](https://chronary.ai) — calendar tools for AI assistants.

Drops 47 calendar tools (manage agents, calendars, and events, find meeting times, run scheduling proposals, configure availability rules, manage webhooks, iCal subscriptions, scoped keys, audit log, and usage) into any MCP-compatible client: Claude Desktop, Cursor, VS Code Copilot, Claude Code, Windsurf.

**One-click install via [Smithery](https://smithery.ai/server/chronary/agent-calendar):** `npx -y @smithery/cli mcp add chronary/agent-calendar --client claude` (swap `--client` for `cursor`, `vscode`, `claude-code`, `windsurf`, …).

## Prerequisites

1. A Chronary account — sign up at [chronary.ai](https://chronary.ai).
2. An API key from the console (starts with `chr_sk_`).
3. Node.js ≥ 18 on the machine where the MCP client runs.

## Client configurations

All examples use `npx -y @chronary/mcp`, which downloads and runs the latest version on demand. No install step required.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

**macOS / Linux:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "npx",
      "args": ["-y", "@chronary/mcp"],
      "env": {
        "CHRONARY_API_KEY": "chr_sk_..."
      }
    }
  }
}
```

**Windows** (uses `cmd /c` because `spawn` can't resolve `npx.cmd` directly):

```json
{
  "mcpServers": {
    "chronary": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@chronary/mcp"],
      "env": {
        "CHRONARY_API_KEY": "chr_sk_..."
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Cursor

Edit `.cursor/mcp.json` (project-level) or `~/.cursor/mcp.json` (user-level):

**macOS / Linux:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "npx",
      "args": ["-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

### VS Code Copilot

Edit `.vscode/mcp.json` (workspace) or run the **MCP: Open User Configuration** command for a user-level config. VS Code uses a different top-level key (`servers`) and requires an explicit `type`:

**macOS / Linux:**

```json
{
  "servers": {
    "chronary": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

**Windows:**

```json
{
  "servers": {
    "chronary": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

### Claude Code

Edit `.mcp.json` at the project root, or `~/.claude.json` for user-level:

**macOS / Linux:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "npx",
      "args": ["-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json` (`%USERPROFILE%\.codeium\windsurf\mcp_config.json` on Windows):

**macOS / Linux:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "npx",
      "args": ["-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "chronary": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@chronary/mcp"],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

> **Windsurf limit:** Cascade enforces a hard cap of 100 total tools across all MCP servers and 20 tool calls per prompt. Chronary exposes 47; consider `--tools` filtering if you stack multiple servers.

## Reducing context with `--tools`

Exposing all 47 tools uses LLM tokens on every request. For focused workflows, whitelist only what you need:

```json
{
  "mcpServers": {
    "chronary": {
      "command": "npx",
      "args": [
        "-y", "@chronary/mcp",
        "--tools", "list_events,find_meeting_time,create_event"
      ],
      "env": { "CHRONARY_API_KEY": "chr_sk_..." }
    }
  }
}
```

## Pointing at a non-production API

For self-hosted Chronary instances or development against a local API:

```json
{
  "args": ["-y", "@chronary/mcp", "--base-url", "http://localhost:8787"]
}
```

## Tools exposed

| Tool | Read-only | Destructive |
|------|-----------|-------------|
| `list_calendars`, `get_calendar` | ✓ | |
| `create_calendar`, `update_calendar` | | |
| `delete_calendar` | | ✓ |
| `list_events`, `get_event` | ✓ | |
| `create_event`, `update_event`, `confirm_event` | | |
| `cancel_event`, `release_event` | | ✓ |
| `list_agents`, `get_agent` | ✓ | |
| `create_agent`, `update_agent` | | |
| `delete_agent` | | ✓ |
| `get_availability`, `find_meeting_time` | ✓ | |
| `get_calendar_context` | ✓ | |
| `list_proposals`, `get_proposal` | ✓ | |
| `create_proposal`, `respond_to_proposal`, `resolve_proposal` | | |
| `cancel_proposal` | | ✓ |
| `get_availability_rules` | ✓ | |
| `set_availability_rules` | | |
| `clear_availability_rules` | | ✓ |
| `list_webhooks`, `get_webhook`, `list_webhook_deliveries` | ✓ | |
| `create_webhook`, `update_webhook` | | |
| `delete_webhook` | | ✓ |
| `list_ical_subscriptions`, `get_ical_subscription` | ✓ | |
| `subscribe_ical`, `update_ical_subscription`, `sync_ical_subscription` | | |
| `delete_ical_subscription` | | ✓ |
| `list_scoped_keys` | ✓ | |
| `create_scoped_key` | | |
| `revoke_scoped_key` | | ✓ |
| `get_audit_log` | ✓ | |
| `accept_terms` | | |
| `get_usage` | ✓ | |

Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) are surfaced to MCP clients so hosts can decide whether to require user confirmation.

## Troubleshooting

**"spawn npx ENOENT" on Windows** — use the `cmd /c npx ...` form shown above.

**"CHRONARY_API_KEY is required"** — the env block must be nested under the server entry, not at the top of the config file.

**Tools aren't showing up** — restart the MCP client after editing the config. Most clients only read the config on startup.

**Verify the binary runs locally:**

```sh
CHRONARY_API_KEY=test npx -y @chronary/mcp --help
```

## Links

- [Chronary docs](https://docs.chronary.ai)
- [MCP spec](https://modelcontextprotocol.io)
- [Report an issue](https://github.com/Chronary/chronary/issues)

## License

Apache-2.0
