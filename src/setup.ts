// Keyless start (#2335): `chronary-mcp` launched without CHRONARY_API_KEY
// serves one tool, `sign_up_anonymous`. It creates a claimable organization
// (POST /v1/agent/sign-up/anonymous: no email, a key that works at once at
// Sandbox limits, a one-time claim link for a person, deleted after 72 hours
// unclaimed). On success the caller registers the full tool set with the new
// key in this same process, and this tool goes away.
//
// The hosted server (https://api.chronary.ai/mcp) has no such tool: it runs
// tools only with a key, and a key issued mid-session can't be written into a
// hosted client's config. A stdio process can swap its key in place.
import { z } from 'zod';
import { Chronary, ChronaryError } from '@chronary/sdk';
import type { McpServerLike, McpToolHandlerResult } from '@chronary/toolkit/mcp';

export const SETUP_TOOL_NAME = 'sign_up_anonymous';

export const DEFAULT_BASE_URL = 'https://api.chronary.ai';
export const DEFAULT_AGENT_NAME = 'MCP agent';

export const SETUP_TOOL_DESCRIPTION = [
  'Sign up for Chronary without an email and get a working calendar API key. This server was started without CHRONARY_API_KEY, so this is the only tool until you call it.',
  'It creates a claimable organization: an agent, an Organization key that works at once (Sandbox plan: small monthly quotas; no email, no webhook endpoints), and a one-time claim_url.',
  'Give claim_url to the person who should own the calendar: opening it while signed in to the Chronary console moves the agent, calendar and events into their account. Unclaimed, the key stops working and everything is deleted after 72 hours (expires_at).',
  'After it succeeds the full set of calendar tools is available in this session.',
  'Calling it accepts the Terms of Service (https://chronary.ai/terms) for the person or organization you act for.',
].join(' ');

export const setupInputSchema = {
  agent_name: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe(`Display name for the new agent (default "${DEFAULT_AGENT_NAME}").`),
  tos_version: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe(
      'Terms of Service version you accept. Omit it to accept the current version (read from GET /v1/auth/terms/current). A version you pass is never replaced: if it is out of date, the tool returns the current one.',
    ),
};

export interface AnonymousSignUp {
  api_key: string;
  org_id: string;
  agent_id: string;
  claim_url: string;
  expires_at: string;
  plan: string;
}

/** The parts of the SDK client the setup tool uses (a seam for tests). */
export interface SignUpClient {
  agentAuth: {
    signUpAnonymous(params: { agent_name: string; tos_version: string }): PromiseLike<AnonymousSignUp>;
  };
}

export interface SetupDeps {
  baseUrl?: string;
  fetch?: typeof fetch;
  extraHeaders?: Record<string, string>;
  /** Builds the keyless client; defaults to `new Chronary({ apiKey: '', baseUrl })`. */
  createClient?: () => SignUpClient;
  /** Called once with the new key, before the result returns: register the full tool set. */
  onSignedUp: (apiKey: string) => void;
}

/** GET /v1/auth/terms/current → the version a sign-up must accept. */
export async function fetchCurrentTermsVersion(baseUrl: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/v1/auth/terms/current`, {
    headers: { Accept: 'application/json' },
  });
  const body = (await res.json().catch(() => null)) as { version?: unknown } | null;
  if (!res.ok || typeof body?.version !== 'string' || body.version === '') {
    throw new Error(`Could not read the current Terms version (HTTP ${res.status}).`);
  }
  return body.version;
}

function staleCurrentVersion(err: unknown): string | undefined {
  if (!(err instanceof ChronaryError) || err.status !== 409 || err.errorType !== 'tos_version_stale') return undefined;
  const v = err.body?.current_version;
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/**
 * Sign up with no email. Without a `tos_version` it reads the current one and,
 * on 409 `tos_version_stale` (the Terms moved between the two calls), retries
 * once with `current_version`. A `tos_version` the caller passed is never
 * swapped for another: its 409 goes back to the caller with the current
 * version (setupErrorResult).
 */
export async function signUpAnonymous(
  client: SignUpClient,
  params: { agent_name?: string; tos_version?: string },
  termsVersion: () => Promise<string>,
): Promise<AnonymousSignUp> {
  const agentName = params.agent_name ?? DEFAULT_AGENT_NAME;
  const pinned = params.tos_version !== undefined;
  const first = params.tos_version ?? (await termsVersion());
  try {
    return await client.agentAuth.signUpAnonymous({ agent_name: agentName, tos_version: first });
  } catch (err) {
    const current = staleCurrentVersion(err);
    if (pinned || !current || current === first) throw err;
    return await client.agentAuth.signUpAnonymous({ agent_name: agentName, tos_version: current });
  }
}

const text = (value: unknown, isError = false): McpToolHandlerResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
});

/** A tool error the model can act on; API errors keep their type and message. */
export function setupErrorResult(err: unknown): McpToolHandlerResult {
  if (err instanceof ChronaryError) {
    const current = staleCurrentVersion(err);
    const hint =
      err.errorType === 'anonymous_signup_disabled'
        ? 'Sign-up without an email is not available on this API. Create an account at https://console.chronary.ai (or sign up with an email through POST /v1/agent/sign-up), then restart this server with CHRONARY_API_KEY set.'
        : err.status === 429
          ? 'Too many sign-ups from this network. Try again later (see retry_after_seconds), or sign up with an email.'
          : current
            ? `The tos_version you passed is out of date; the current version is ${current}. Read https://chronary.ai/terms, then call again with tos_version "${current}" (or without tos_version) to accept it.`
            : err.status === 0
              ? // A lost response (timeout or connection error): the request may have
                // reached the API. Calling again signs up a second organization.
                'The sign-up response was lost (timeout or connection error). The organization may already exist; calling sign_up_anonymous again creates another one and spends more of this network\'s sign-up budget (3 an hour). Check the connection before retrying.'
              : undefined;
    const retryAfter = err.headers?.get?.('retry-after');
    return text(
      {
        error: {
          type: err.errorType ?? (err.status === 0 ? 'connection_error' : `http_${err.status}`),
          message: err.message,
          ...(current ? { current_version: current } : {}),
          ...(retryAfter ? { retry_after_seconds: Number(retryAfter) || retryAfter } : {}),
          ...(hint ? { hint } : {}),
        },
      },
      true,
    );
  }
  return text({ error: { type: 'setup_failed', message: err instanceof Error ? err.message : String(err) } }, true);
}

/** What the agent should do next; returned with the key. */
export function nextSteps(toolsLoaded = true): string[] {
  return [
    'Give claim_url to the person who should own this calendar now: it is shown only here and works once. Opening it while signed in to https://console.chronary.ai moves the agent, calendar and events into their account; this key then stops working.',
    'Unclaimed, the key stops working at expires_at (72 hours) and the calendar and its events are deleted.',
    toolsLoaded
      ? 'The calendar tools are now available in this session. The key lives only in this server process: to keep using it after a restart, set CHRONARY_API_KEY to api_key in this MCP server\'s configuration. If your client does not show the new tools, restart it with that variable set.'
      : 'The calendar tools could not be loaded in this session. Restart this MCP server with CHRONARY_API_KEY set to api_key.',
    'Sandbox plan: no email and no webhook endpoints.',
  ];
}

/**
 * Register `sign_up_anonymous`. A second call while one is running shares
 * it; after a success the tool removes itself (the server then announces the
 * changed tool list) and a stale call answers that the key is already set.
 */
export function registerSetupTool(server: McpServerLike, deps: SetupDeps): void {
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  // No retries: a 503 here is a refusal (switched off, paused, daily cap), a
  // network-budget 429 can say "in 20 minutes", and a retried POST after a
  // lost response would create a second org. The agent decides what next.
  const createClient =
    deps.createClient ??
    (() =>
      new Chronary({ apiKey: '', baseUrl, extraHeaders: deps.extraHeaders, maxRetries: 0 }) as unknown as SignUpClient);
  let inflight: Promise<McpToolHandlerResult> | null = null;
  let done = false;

  const run = async (params: Record<string, unknown>): Promise<McpToolHandlerResult> => {
    let result: AnonymousSignUp;
    try {
      result = await signUpAnonymous(
        createClient(),
        {
          agent_name: typeof params.agent_name === 'string' ? params.agent_name : undefined,
          tos_version: typeof params.tos_version === 'string' ? params.tos_version : undefined,
        },
        () => fetchCurrentTermsVersion(baseUrl, deps.fetch),
      );
    } catch (err) {
      return setupErrorResult(err);
    }
    // The org exists now: whatever happens next, the key and claim link go
    // back to the agent, or nobody could ever claim or use it.
    done = true;
    let loaded = true;
    try {
      deps.onSignedUp(result.api_key);
    } catch {
      loaded = false;
    }
    (handle as { remove?: () => void } | undefined)?.remove?.();
    return text({ ...result, next_steps: nextSteps(loaded) });
  };

  const handle = server.registerTool(
    SETUP_TOOL_NAME,
    {
      description: SETUP_TOOL_DESCRIPTION,
      inputSchema: setupInputSchema,
      annotations: {
        title: 'Sign up without an email',
        readOnlyHint: false,
        // Every non-read-only tool says destructiveHint: true, as the Claude
        // connectors directory requires (#2608): this one creates an org.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: Record<string, unknown>) => {
      if (done) {
        return text({ error: { type: 'already_signed_up', message: 'This server already has a key; use the calendar tools.' } }, true);
      }
      if (!inflight) {
        inflight = run(params).finally(() => {
          inflight = null;
        });
      }
      return inflight;
    },
  );
}
