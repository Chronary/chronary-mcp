# Changelog

All notable changes to `@chronary/mcp` will be documented in this file starting with the soft-launch release.

## 0.1.3 — 2026-05-20

- First OIDC + Sigstore provenance release. Published via npm Trusted Publishing from `Chronary/chronary-mcp`'s `release-artifact.yml`. No behavioral change vs 0.1.2 — 0.1.2 was the manual bootstrap publish (classic token, no provenance) required because npm has no Pending Publisher flow.

## 0.1.2 — 2026-05-20

- Initial public release as **`@chronary/mcp`** on npm (scoped, org-owned).
- Renamed from the unscoped `chronary-mcp` (briefly published 2026-05-20 then unpublished within the 72-hour window — never publicly consumed). The rename brings the package in line with the `@chronary/sdk`, `@chronary/toolkit`, and `@chronary/schemas` siblings and makes it discoverable on https://www.npmjs.com/org/chronary.
- The CLI binary name remains **`chronary-mcp`** — only the npm install path changed:
  - Old: `npx -y chronary-mcp`
  - New: `npx -y @chronary/mcp`
- Add `CONTRIBUTING.md` to the public mirror documenting that this repo is generated from a private monorepo; PRs are welcome as proof-of-concept but can't be merged directly. No behavioral change.
