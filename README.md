# @chronary/mcp

MCP server for [Chronary](https://chronary.ai) — calendar tools for AI assistants.

Drops 23 calendar tools (list/create/update/delete events, check availability, manage webhooks, iCal subscriptions, usage) into any MCP-compatible client: Claude Desktop, Cursor, VS Code Copilot, Claude Code, Windsurf.

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

> **Windsurf limit:** Cascade enforces a hard cap of 100 total tools across all MCP servers and 20 tool calls per prompt. Chronary exposes 23; consider `--tools` filtering if you stack multiple servers.

## Reducing context with `--tools`

Exposing all 23 tools uses ~3–5k LLM tokens per request. For focused workflows, whitelist only what you need:

```json
{
  "mcpServers": {
    "chronary": {
      "command": "npx",
      "args": [
        "-y", "@chronary/mcp",
        "--tools", "list_events,check_availability,create_event"
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
| `create_event`, `update_event` | | |
| `delete_event` | | ✓ |
| `check_availability` | ✓ | |
| `list_webhooks`, `get_webhook` | ✓ | |
| `create_webhook`, `update_webhook` | | |
| `delete_webhook` | | ✓ |
| `list_ical_subscriptions`, `get_ical_subscription` | ✓ | |
| `create_ical_subscription`, `update_ical_subscription`, `sync_ical_subscription` | | |
| `delete_ical_subscription` | | ✓ |
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
