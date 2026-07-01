# Dockerfile for the Glama MCP registry introspection check.
#
# Glama builds and runs this image, then performs the standard MCP introspection
# exchange (tools/list). Its only requirement is that the server starts and
# responds — see https://glama.ai/mcp/servers "Add Server" checks.
#
# We run the PUBLISHED @chronary/mcp package rather than building from this
# source tree on purpose: the package depends on `@chronary/sdk` and
# `@chronary/toolkit` via pnpm `workspace:*` specifiers, which only resolve
# inside the monorepo — a standalone `npm install` in this mirrored repo would
# fail. The published npm tarball has those deps resolved to real versions.
#
# CHRONARY_API_KEY is required for the server to boot, but tools/list returns
# the static tool definitions without calling the API, so a placeholder value is
# sufficient for introspection. Real usage supplies a genuine chr_sk_ / chr_ak_
# key. See README.md for client configuration.
FROM node:20-slim

ENV CHRONARY_API_KEY=placeholder-for-introspection

# stdio MCP server; Glama drives it over stdin/stdout.
ENTRYPOINT ["npx", "-y", "@chronary/mcp"]
