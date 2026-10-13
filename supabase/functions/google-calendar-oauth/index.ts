// One-time OAuth setup for the Google Calendar sync.
//
// There is no Supabase Auth in this project ([auth] enabled = false in
// supabase/config.toml — see docs/04-setup.md), so the standard
// Supabase-Auth Google provider doesn't apply here. This function runs the
// OAuth Authorization Code flow by hand, once, to obtain a refresh token for
// the single Google account google-calendar-sync acts as, and stores it in
// google_calendar_account (RLS on, no policies — only this function and
// google-calendar-sync, both using the service-role key, can read or write
// it).
//
// Two GET routes:
//   ?start=<GOOGLE_OAUTH_SETUP_SECRET>   redirects to Google's consent screen
//   ?code=...&state=...                  Google's redirect back; exchanges
//                                         the code for tokens
//
// verify_jwt is OFF for this function (see supabase/config.toml) because
// Google's redirect carries no Supabase JWT. The `start` route is instead
// gated by a secret query param, and the callback is gated by a signed
// `state` nonce (HMAC over a timestamped random value, same secret) so a
// stray `?code=` from someone else's OAuth flow can't be replayed against
// this one.
//
// Scope is deliberately the narrow
// https://www.googleapis.com/auth/calendar.events — read/write events, no
// calendar management.
//
// Operational trap (see docs/04-setup.md): while the Google Cloud OAuth
// consent screen is in "Testing" publishing status, refresh tokens expire
// after 7 days. The consent screen must be published to "In Production"
// (accepting the "unverified app" warning for a single-user internal tool)
// and this flow re-run once after publishing, or the sync silently stops
// working every week.

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const REDIRECT_URI = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') ?? '';
const SETUP_SECRET = Deno.env.get('GOOGLE_OAUTH_SETUP_SECRET') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// --- state signing -----------------------------------------------------

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SETUP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signState(): Promise<string> {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

async function verifyState(state: string): Promise<boolean> {
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const expected = await hmac(`${ts}.${nonce}`);
  if (expected !== sig) return false;
  const age = Date.now() - Number(ts);
  return Number.isFinite(age) && age >= 0 && age < 10 * 60_000; // 10 minute window
}

// --- routes --------------------------------------------------------------

async function handleStart(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const presented = url.searchParams.get('start') ?? '';
  if (!SETUP_SECRET || presented !== SETUP_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!CLIENT_ID || !REDIRECT_URI) {
    return new Response('Google OAuth is not configured', { status: 500 });
  }

  const state = await signState();
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return Response.redirect(authUrl.toString(), 302);
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Google returned an error: ${error}`, { status: 400 });
  }
  if (!code || !(await verifyState(state))) {
    return new Response('Invalid or expired state', { status: 400 });
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return new Response('Google OAuth is not configured', { status: 500 });
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('token exchange failed', tokenRes.status, body);
    return new Response('Token exchange failed', { status: 502 });
  }

  const token = (await tokenRes.json()) as TokenResponse;
  if (!token.refresh_token) {
    // Google only returns a refresh token on the first consent for this
    // account/scope combination (or when prompt=consent forces it, which the
    // start route always sets) — surface this clearly rather than silently
    // storing an account with no way to refresh.
    return new Response(
      'Google did not return a refresh token. Revoke prior access at https://myaccount.google.com/permissions and retry.',
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const restUrl = `${SUPABASE_URL}/rest/v1/google_calendar_account`;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
  const upsertRes = await fetch(restUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: true,
      refresh_token: token.refresh_token,
      access_token: token.access_token,
      access_token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      last_error: null,
    }),
  });

  if (!upsertRes.ok) {
    const body = await upsertRes.text();
    console.error('storing refresh token failed', upsertRes.status, body);
    return new Response('Failed to store the connection', { status: 500 });
  }

  return new Response(
    'Google Calendar connected. You can close this tab.',
    { status: 200, headers: { 'Content-Type': 'text/plain' } }
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const url = new URL(req.url);
  if (url.searchParams.has('start')) return handleStart(req);
  if (url.searchParams.has('code') || url.searchParams.has('error')) {
    return handleCallback(req);
  }
  return new Response('Missing start or code parameter', { status: 400 });
});
