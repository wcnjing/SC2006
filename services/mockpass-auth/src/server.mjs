import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const serviceDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.resolve(serviceDirectory, '../../.env') });
dotenv.config({ path: path.resolve(serviceDirectory, '.env'), override: true });

const port = Number(process.env.MOCKPASS_AUTH_PORT ?? 3000);
const mockpassUrl = process.env.MOCKPASS_URL ?? 'http://127.0.0.1:5156';
const backendUrl = process.env.MOCKPASS_AUTH_URL ?? `http://127.0.0.1:${port}`;
const mobileRedirectUri = process.env.MOBILE_REDIRECT_URI ?? 'communitylink://mockpass/callback';
const clientId = 'communitylink-local';
const redirectUri = `${backendUrl}/auth/mockpass/callback`;

const required = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name} for Mockpass auth service`);
}

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const mockpassKeys = createRemoteJWKSet(new URL(`${mockpassUrl}/singpass/v2/.well-known/keys`));
const pendingStates = new Map();

function createState() {
  return crypto.randomBytes(24).toString('base64url');
}

function htmlRedirect(url) {
  const encodedUrl = JSON.stringify(url);
  return `<!doctype html><meta name="referrer" content="no-referrer"><script>location.replace(${encodedUrl})</script><p>Return to CommunityLink</p><a href=${JSON.stringify(url)}>Continue</a>`;
}

// Where the app wants the tokens sent after login. The app passes it to /start
// because it differs per platform (web: http://localhost:8081/..., Expo Go:
// exp://<LAN-IP>:8081/--/..., native build: communitylink://...). The tokens
// travel in this URL, so only local addresses ending in mockpass/callback are allowed.
function isAllowedAppRedirect(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!/\/?mockpass\/callback$/.test(`${url.host}${url.pathname}`)) return false;
  if (url.protocol === 'communitylink:' || url.protocol === 'exp:') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function parseNric(subject) {
  const match = /^s=([^,]+)/.exec(subject);
  if (!match) throw new Error('Mockpass token did not contain an NRIC subject');
  return match[1];
}

// Mockpass's relying-party signing key: from a services/mockpass checkout if
// there is one, otherwise from the @opengovsg/mockpass npm package.
function mockpassKeyPath() {
  const checkout = path.resolve(
    serviceDirectory,
    '../mockpass/static/certs/oidc-v2-rp-secret.json',
  );
  if (existsSync(checkout)) return checkout;
  const packageDirectory = path.dirname(
    createRequire(import.meta.url).resolve('@opengovsg/mockpass/package.json'),
  );
  return path.join(packageDirectory, 'static/certs/oidc-v2-rp-secret.json');
}

async function exchangeCode(code) {
  const privateKeyPath = mockpassKeyPath();
  const privateJwk = JSON.parse(await fs.readFile(privateKeyPath, 'utf8')).keys.find(
    (key) => key.use === 'sig',
  );
  if (!privateJwk) throw new Error('Mockpass RP signing key was not found');

  const assertionKey = await importJwk(privateJwk);
  const now = Math.floor(Date.now() / 1000);
  const clientAssertion = await new (await import('jose')).SignJWT({})
    .setProtectedHeader({ alg: privateJwk.alg ?? 'ES256', kid: privateJwk.kid, typ: 'JWT' })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(`${mockpassUrl}/singpass/v2`)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(crypto.randomUUID())
    .sign(assertionKey);

  const response = await fetch(`${mockpassUrl}/singpass/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description ?? 'Mockpass token exchange failed');
  return payload;
}

async function importJwk(jwk) {
  const { importJWK } = await import('jose');
  return importJWK(jwk, jwk.alg ?? 'ES256');
}

async function createSupabaseSession(nric, subject) {
  const email = `${nric.toLowerCase()}@mockpass.local`;
  const password = crypto
    .createHmac('sha256', process.env.SUPABASE_SECRET_KEY)
    .update(`mockpass:${nric}`)
    .digest('base64url');
  const displayName = `Mockpass user ${nric}`;
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, mockpass_subject: subject },
  });
  if (createError && createError.code !== 'email_exists') throw createError;

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;
  const user = created.user ?? users.users.find((item) => item.email === email);
  if (!user) throw new Error('Unable to find the Supabase user for Mockpass identity');

  const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  const { error: profileError } = await supabaseAdmin.rpc('mark_singpass_verified', {
    target_user: user.id,
  });
  if (profileError) throw profileError;
  return session.session;
}

const app = express();
app.get('/health', (_request, response) => response.json({ ok: true }));

app.get('/auth/mockpass/start', (request, response) => {
  const requested = request.query.redirect_uri;
  if (
    requested !== undefined &&
    !(typeof requested === 'string' && isAllowedAppRedirect(requested))
  ) {
    response.status(400).send('This app return address is not allowed.');
    return;
  }
  const state = createState();
  const nonce = createState();
  pendingStates.set(state, {
    nonce,
    createdAt: Date.now(),
    appRedirect: requested ?? mobileRedirectUri,
  });
  const url = new URL(`${mockpassUrl}/singpass/v2/auth`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  response.redirect(url.toString());
});

app.get('/auth/mockpass/callback', async (request, response) => {
  try {
    const { code, state } = request.query;
    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (typeof code !== 'string' || typeof state !== 'string' || !pending) {
      throw new Error('Invalid or expired Mockpass callback');
    }
    if (Date.now() - pending.createdAt > 5 * 60 * 1000) {
      throw new Error('Mockpass login expired');
    }

    const tokenPayload = await exchangeCode(code);
    const verified = await jwtVerify(tokenPayload.id_token, mockpassKeys, {
      issuer: `${mockpassUrl}/singpass/v2`,
      audience: clientId,
    });
    if (verified.payload.nonce !== pending.nonce) throw new Error('Invalid Mockpass nonce');
    const subject = verified.payload.sub;
    if (typeof subject !== 'string') throw new Error('Mockpass token has no subject');

    const session = await createSupabaseSession(parseNric(subject), subject);
    const redirect = new URL(pending.appRedirect);
    redirect.searchParams.set('access_token', session.access_token);
    redirect.searchParams.set('refresh_token', session.refresh_token);
    response.send(htmlRedirect(redirect.toString()));
  } catch (error) {
    console.error('Mockpass authentication failed:', error);
    response.status(500).send('Mockpass authentication failed. Check the auth service logs.');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Mockpass auth service listening on ${backendUrl}`);
});
