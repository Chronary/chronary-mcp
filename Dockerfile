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
# The package version is pinned so the image is reproducible. It MUST equal the
# `version` in package.json: this file reaches the public mirror in the same
# release that publishes that version to npm. packages/mcp/test/entry.test.ts
# and the release coordinator's versionChecks (.github/public-artifacts.json)
# both fail when the two drift, so bump this line with every version bump.
#
# CHRONARY_API_KEY is required for the server to boot, but tools/list returns
# the static tool definitions without calling the API, so a placeholder value is
# sufficient for introspection. Real usage supplies a genuine chr_sk_ / chr_ak_
# key. See README.md for client configuration.
FROM node:20-slim

ARG CHRONARY_MCP_VERSION=1.6.0

# Install at build time (as root, into the read-only global prefix) so the
# container needs no npm cache or network at run time.
RUN npm install -g --omit=dev "@chronary/mcp@${CHRONARY_MCP_VERSION}" \
  && npm cache clean --force

ENV CHRONARY_API_KEY=placeholder-for-introspection

# Run as the unprivileged `node` user that ships with the image. Its home
# (/home/node) is writable, so anything that wants a cache dir still works.
USER node
WORKDIR /home/node

# stdio MCP server; Glama drives it over stdin/stdout.
ENTRYPOINT ["chronary-mcp"]
