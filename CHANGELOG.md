# Changelog

All notable changes to `@chronary/mcp` will be documented in this file starting with the soft-launch release.

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
