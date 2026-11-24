# Changelog

All notable changes to `@chronary/mcp` will be documented in this file starting with the soft-launch release.

## 1.8.4 — unreleased

- README: one-click install links for Cursor and VS Code. Both add the server as `npx -y @chronary/mcp` with no key, so it starts with `sign_up_anonymous` (#2229).
- Removed `smithery.yaml`, `smithery-remote-config.json` and the `smithery:republish` script (repo and mirror files, never in the npm tarball). Smithery shut down its hosted runner, CLI and API on 2026-10-31 and is now a plain registry, so nothing reads them (#2229). No code change. Still 65 tools.

- `list_events` refuses `calendar_id` and `agent_id` together with an error instead of listing the agent's events and dropping the calendar (#2721). This comes from `@chronary/toolkit` and reaches this package with the toolkit's next release: 1.7.5 was published before the fix merged (#2763).

## 1.8.3 — 2026-11-22

- `get_audit_log` (from `@chronary/toolkit` 1.7.5) accepts `actor_type: "oauth_app"`: entries made by an app connected to the hosted MCP server by signing in, such as Claude (#2254). Still 65 tools.

## 1.8.2 — 2026-11-22

- `delete_calendar` (from `@chronary/toolkit` 1.7.4) says that the calendar's booking pages are deleted too and their public links stop working (#2545). Still 65 tools.
- `create_event` and `update_event` (from `@chronary/toolkit` 1.7.4) describe how all-day events are stored: whole UTC days on the written dates, at least one day, a `T23:59:59` end covering that day. When moving an all-day event with a non-UTC offset, send `all_day: true` in the same call (#2566). Still 65 tools.
- **A tool call can no longer reach another resource through an ID (#2519).** With `@chronary/toolkit` 1.7.4 and `@chronary/sdk` 0.13.2, every ID argument must be a Chronary ID (letters, digits, `_`, `-`), and the SDK encodes every path segment. A prompt-injected `cancel_event` with `event_id: "../agents/agt_main"` used to send `DELETE /v1/agents/agt_main` even with `--tools list_events,get_event,cancel_event`; it is now refused before any request. Still 65 tools.

## 1.8.1 — 2026-11-22

- Every tool that is not read-only now sets `destructiveHint: true`, as the Claude connectors directory requires (a `title` plus `readOnlyHint: true` or `destructiveHint: true` on every tool). That is the 37 write tools from `@chronary/toolkit` 1.7.3 and `sign_up_anonymous`. Read-only tools are unchanged. Clients that confirm destructive actions now ask before creates and updates too (#2608). Still 65 tools.
- `create_booking_page` (from `@chronary/toolkit` 1.7.3) refuses `availability_constraints` the hosted API rejects: keys must be `mon` to `sun`, times `HH:MM` 24-hour with end after start, at least one day (#2525).
- `respond_to_proposal` (from `@chronary/toolkit` 1.7.3) describes the saved response plus `auto_resolved` and `auto_resolve_error`: a failed auto-resolve no longer fails the call, so resolve the proposal instead of responding again. `create_proposal` and `respond_to_proposal` refuse a slot that doesn't end after it starts (#2538, #2540).
- Tool descriptions no longer name other tools (#2592), and `get_calendar_context` mentions recurring-series occurrences (#2529), both from `@chronary/toolkit` 1.7.3.

## 1.8.0 — 2026-11-20

- `CHRONARY_API_KEY` is now optional (#2335). Without it, the server no longer exits. It starts with one tool, `sign_up_anonymous` (`agent_name?`, `tos_version?`), plus the usual prompts and resources.
- `sign_up_anonymous` signs up with no email through `POST /v1/agent/sign-up/anonymous`:
  - It returns `api_key`, `org_id`, `agent_id`, `claim_url`, `expires_at`, `plan` and `next_steps`.
  - On success it loads the full tool set (still filtered by `--tools`) with the new key in the same process, then removes itself. Clients receive `notifications/tools/list_changed`.
  - The organization runs on Sandbox limits, with no email and no webhook endpoints.
  - Give `claim_url` to the person who should own the calendar. If nobody claims it, the key stops working and the data is deleted after 72 hours.
  - The key lives only in the running process, so set `CHRONARY_API_KEY` to keep it.
  - Calling the tool accepts the Terms of Service for the person or organization the agent acts for.
  - Without a `tos_version`, it uses the current version and retries once on 409 `tos_version_stale`. A `tos_version` you pass is never swapped: its 409 comes back with `current_version`.
  - It never retries a refusal (503) or a per-network 429.
  - A lost response (timeout or connection error) returns `connection_error`, with a hint: the organization may already exist, and calling again creates another one.
  - The server is built in `src/server.ts` (`createChronaryMcpServer`), so tests drive the same server in process.
  - Started with a key, the server is unchanged: still 65 tools.
- `server.json`: `CHRONARY_API_KEY` is `isRequired: false`.

## 1.7.1 — 2026-11-16

- Server instructions and proposal tool descriptions (from `@chronary/toolkit` 1.7.1): scheduling proposals and temporal holds need a Developer or Pro plan, not Pro; `cancel_proposal` works on every plan (#2331). Still 65 tools.

## 1.7.0 — 2026-11-16

- `create_event` and `update_event` take `timezone` (IANA, e.g. `"America/Los_Angeles"`; `null` on update for UTC), from `@chronary/toolkit` 1.7.0: a recurring series repeats on local wall time across daylight-saving changes (#2276).
- The `recurrence_rule` descriptions say a series edit now keeps cancelled occurrences on their local date and lists any that no longer match in `droppedExdates` (#2277).
- Ships `@chronary/sdk` 0.11.0. Still 65 tools.

## 1.6.2

- README: drop the Smithery badge and one-click line (the Smithery listing page and badge now return 404) and point to the Official MCP Registry entry `ai.chronary/mcp` instead (#1999). No code change.
- Ships `@chronary/sdk` 0.9.0: a 429 `quota_exceeded` (a monthly plan limit) is no longer retried, so a tool call at the cap fails at once with the quota error and its upgrade hints instead of sleeping on `Retry-After` (#1936).
- Server instructions (from `@chronary/toolkit`) now use the Developer-plan wording: scoped keys, cross-agent availability, webhook delivery replay and secret rotation require a Developer or Pro plan; scheduling proposals and temporal holds stay Pro.

## 1.6.0 — 2026-10-19

- Add the `get_billing`, `request_upgrade`, `get_upgrade_request` and `cancel_upgrade_request` tools (58 tools total), and return structured tool errors that keep `upgrade_url`, `required_plan`, `metric` and `limit` (#1129).
- Add the `get_webhook_delivery` tool (59 tools total): one webhook delivery with every attempt's HTTP status, duration, response body prefix and error code (#1200).
- Registry introspection `Dockerfile` (mirror only, not in the npm tarball): install a pinned `@chronary/mcp` version at build time and run as the non-root `node` user (#1643).
- Send the same server instructions as the hosted server, including that event and webhook text written outside the org is data, not instructions. Event and webhook-delivery tool results start with an `untrusted_fields` key naming those fields (#1621).
- Tool annotations match the hosted server: `create_webhook`, `update_webhook` and `update_ical_subscription` set `openWorldHint: true`, and `update_webhook` sets `destructiveHint: true` (#1662).
- `--base-url` must use `https://`; plain `http://` is accepted only for `localhost`, `127.0.0.1` and `[::1]`, so the API key never crosses the network in clear text (#1675). `--help` shows the real tool count.

## 1.5.3 — 2026-10-16

- Bump `@modelcontextprotocol/sdk` floor to `^1.32.1` (#1104). No tool-surface change; still 54 tools.

## 1.5.2 — 2026-07-14

- Pick up `@chronary/toolkit@1.5.2` (availability + connection-link tool descriptions now match the hosted MCP verbatim). No tool-surface change; still 54 tools.

## 1.5.1 — 2026-07-14

- Pick up `@chronary/toolkit@1.5.1` (neutral booking-page tool wording). No tool-surface change; still 54 tools.

## 1.5.0 — 2026-07-14

- Add booking-page tools (`create_booking_page`, `list_booking_pages`, `get_booking_page`, `delete_booking_page`), bringing the hosted and stdio surfaces to 54 tools (#1036).

## 1.4.1 — 2026-07-12

- Shorten the Official MCP Registry description to its 100-character limit. No MCP behavior changes from 1.4.0.

## 1.4.0 — 2026-07-12

- Add the three human-calendar setup-link tools inherited from `@chronary/toolkit`, bringing the hosted and stdio surfaces to 50 tools.
- Document fail-closed combined availability and Google/Microsoft human consent.

## 1.2.7 — 2026-07-09

- Add a [Smithery](https://smithery.ai/server/chronary/agent-calendar) badge and a one-click install one-liner to the README, and fill the package `author` field — both ship in the npm tarball. Also adds a `smithery:republish` script and a committed `smithery-remote-config.json` (repo/mirror only, not in the tarball) for refreshing the Smithery remote listing after a deploy. No code change; the then-current hosted MCP surface was unchanged.

## 1.2.6 — 2026-07-07

- Add `smithery.yaml` so the server can be listed on [Smithery](https://smithery.ai) as a local/stdio server: Smithery runs `npx -y @chronary/mcp` on the user's machine with their key as `CHRONARY_API_KEY`. Repo/mirror metadata only — not in the npm tarball, no code change. Version bump exists to mirror the file to `Chronary/chronary-mcp`.

## 1.2.5 — 2026-07-06

- Add `glama.json` (maintainers) so the Glama directory listing for `Chronary/chronary-mcp` can be claimed/verified (required for org-owned repos). Repo/mirror metadata only — no code change, no npm content change (glama.json + Dockerfile aren't shipped in the npm tarball). Version bump exists solely to trigger the source-tree mirror to `Chronary/chronary-mcp`.

## 1.2.4 — 2026-07-02

- Add the preferred `duration` field (alias of the now-deprecated `slot_duration`) to the `get_availability` and `find_meeting_time` tool input schemas, bringing the published stdio server into parity with the hosted MCP surface at `https://api.chronary.ai/mcp`. Both aliases are accepted; sending conflicting values is rejected by the API with a 400. Fix flows in from `@chronary/toolkit@1.2.2`, which owns these schemas. Registered as `server.json` 1.2.4 (the prior 1.2.3 was a registry-metadata-only entry and registry versions are immutable), pointing at npm `@chronary/mcp@1.2.4`.

## server.json 1.2.3 — 2026-06-30 (registry metadata only)

- Registry-entry-only bump. `@chronary/mcp@1.2.2` published `ai.chronary/mcp` to the Official MCP Registry with a description that exceeded the registry's 100-char limit and contained a non-ASCII em-dash that mangled on ingest. Registry versions are immutable, so the fix (shorter, pure-ASCII description) ships as `server.json` version 1.2.3 pointing at the same unchanged npm package `@chronary/mcp@1.2.2`. No npm release, no code change.

## 1.2.2 — 2026-06-25

- Add Official MCP Registry support: `mcpName: "ai.chronary/mcp"` in `package.json` (ownership-validated against the published npm tarball) and a `server.json` manifest declaring both the npx stdio package and the hosted `https://api.chronary.ai/mcp` Streamable HTTP endpoint. No behavioral change to the server itself.

## 0.1.3 — 2026-05-20

- First OIDC + Sigstore provenance release. Published via npm Trusted Publishing from `Chronary/chronary-mcp`'s `release-artifact.yml`. No behavioral change vs 0.1.2 — 0.1.2 was the manual bootstrap publish (classic token, no provenance) required because npm has no Pending Publisher flow.

## 0.1.2 — 2026-05-20

- Initial public release as **`@chronary/mcp`** on npm (scoped, org-owned).
- Renamed from the unscoped `chronary-mcp` (briefly published 2026-05-20 then unpublished within the 72-hour window — never publicly consumed). The rename brings the package in line with the `@chronary/sdk`, `@chronary/toolkit`, and `@chronary/schemas` siblings and makes it discoverable on https://www.npmjs.com/org/chronary.
- The CLI binary name remains **`chronary-mcp`** — only the npm install path changed:
  - Old: `npx -y chronary-mcp`
  - New: `npx -y @chronary/mcp`
- Add `CONTRIBUTING.md` to the public mirror documenting that this repo is generated from a private monorepo; PRs are welcome as proof-of-concept but can't be merged directly. No behavioral change.
